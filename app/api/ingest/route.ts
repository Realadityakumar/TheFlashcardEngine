
// IMPORTANT: Use App Router exports, NOT Pages Router config object
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { validatePDFUpload, validateFlashcards } from '@/lib/validators'
import { detectPDFType, extractTextFromPDF, getPDFPageCount, extractTextByChunks, CHUNK_THRESHOLD, CHUNK_SIZE } from '@/lib/pdf-detector'
import { generateWithVision, generateWithText, generateFromChunks, RawCard, GeminiRateLimitError } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read form data' }, { status: 400 })
  }

  const file = formData.get('pdf') as File | null
  const title = formData.get('title') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // Security validation
  const validation = await validatePDFUpload(buffer, file.name, file.size)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
      }

      try {
        // Duplicate detection
        const pdfHash = createHash('sha256').update(buffer).digest('hex')
        const existing = await prisma.deck.findUnique({ where: { pdfHash } })
        if (existing) {
          send({ status: 'done', existing: true, deckId: existing.id })
          controller.close()
          return
        }

        send({ status: 'analyzing' })

        // Save to tmp for pdf-detector
        tmpPath = `/tmp/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
        await fs.writeFile(tmpPath, buffer)

        const pageCount = await getPDFPageCount(buffer)
        console.log(`[ingest] PDF has ${pageCount} pages`)

        let rawCards: RawCard[]
        let pdfType: 'vision' | 'text' = 'text'

        if (pageCount > CHUNK_THRESHOLD) {
          pdfType = await detectPDFType(buffer, { maxPages: 10, skipPages: 10 })
          if (pdfType === 'vision') {
            send({ status: 'error', error: 'This PDF is too large and contains too many images to be processed automatically. Please try a smaller file or a text-heavy PDF.' })
            controller.close()
            return
          }
        } else {
          pdfType = await detectPDFType(buffer)
        }

        // Calculate ETA accurately based on API calls (chunks) rather than per-page
        let estimatedSeconds = 15 // base overhead
        
        if (pageCount > CHUNK_THRESHOLD) {
           const chunksCount = Math.ceil(pageCount / CHUNK_SIZE)
           // Each chunk is one text generation call + 2s sleep
           estimatedSeconds += chunksCount * 20 
        } else {
           // Single prompt to Gemini
           estimatedSeconds += pdfType === 'vision' ? 25 : 15
        }

        send({ 
          status: 'processing', 
          pageCount, 
          pdfType, 
          estimatedSeconds 
        })

        if (pageCount > CHUNK_THRESHOLD) {
          console.log(`[ingest] large PDF detected, chunking into ${Math.ceil(pageCount / CHUNK_SIZE)} chunks`)
          const chunks = await extractTextByChunks(buffer, CHUNK_SIZE)

          const totalTextLength = chunks.reduce((acc, chunk) => acc + chunk.text.trim().length, 0)
          if (totalTextLength < 50) {
             send({ status: 'error', error: 'This PDF appears to be empty or contains no readable text.' })
             controller.close()
             return
          }

          rawCards = await generateFromChunks(chunks)
        } else {
          if (pdfType === 'vision') {
            rawCards = await generateWithVision(buffer)
          } else {
            const text = await extractTextFromPDF(buffer)
            if (text.trim().length < 50) {
               send({ status: 'error', error: 'This PDF appears to be empty or contains no readable text.' })
               controller.close()
               return
            }
            rawCards = await generateWithText(text)
          }
        }

        // Validate cards
        const validCards = validateFlashcards(rawCards)
        if (validCards.length === 0) {
           send({ status: 'error', error: 'No valid flashcards could be generated from this PDF. Try a different file.' })
           controller.close()
           return
        }

        send({ status: 'saving' })

        // Save
        const deck = await prisma.deck.create({
          data: {
            title: title || file.name.replace(/\.pdf$/i, ''),
            fileName: file.name,
            pdfHash,
            cards: { create: validCards },
          },
          include: { cards: true },
        })

        send({ status: 'done', existing: false, deck })

      } catch (error: any) {
        console.error('[ingest] error:', error)
        if (error instanceof GeminiRateLimitError) {
           send({ status: 'error', error: error.message, retryAfterSeconds: error.retryAfterSeconds })
        } else {
           send({ status: 'error', error: 'Something went wrong processing your PDF. Please try again.' })
        }
      } finally {
        if (tmpPath) await fs.unlink(tmpPath).catch(() => {})
        controller.close()
      }
    }
  })

  return new Response(stream, { 
    headers: { 
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    } 
  })
}


