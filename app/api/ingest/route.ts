
// IMPORTANT: Use App Router exports, NOT Pages Router config object
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { validatePDFUpload, validateFlashcards } from '@/lib/validators'
import { detectPDFType, extractTextFromPDF } from '@/lib/pdf-detector'
import { generateWithVision, generateWithText } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File | null
    const title = formData.get('title') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Security validation (size, extension, magic bytes)
    const validation = await validatePDFUpload(buffer, file.name, file.size)
    if (!validation.valid)
      return NextResponse.json({ error: validation.error }, { status: 400 })

    // Duplicate detection via SHA-256 hash
    const pdfHash = createHash('sha256').update(buffer).digest('hex')
    const existing = await prisma.deck.findUnique({ where: { pdfHash } })
    if (existing)
      return NextResponse.json({ existing: true, deckId: existing.id })

    // Save to tmp for pdf-detector
    tmpPath = `/tmp/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
    await fs.writeFile(tmpPath, buffer)

    // Route: vision (has educational images) or text (plain text)
    const pdfType = await detectPDFType(buffer)
    console.log(`[ingest] routing to ${pdfType} path`)

    let rawCards
    if (pdfType === 'vision') {
      rawCards = await generateWithVision(buffer)
    } else {
      const text = await extractTextFromPDF(buffer)
      rawCards = await generateWithText(text)
    }

    // Validate and sanitize Gemini output
    const validCards = validateFlashcards(rawCards)
    if (validCards.length === 0)
      return NextResponse.json(
        { error: 'No valid flashcards could be generated from this PDF. Try a different file.' },
        { status: 422 }
      )

    // Save deck and cards atomically
    const deck = await prisma.deck.create({
      data: {
        title: title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        pdfHash,
        cards: { create: validCards },
      },
      include: { cards: true },
    })

    return NextResponse.json({ deck })

  } catch (error) {
    console.error('[ingest] error:', error)
    return NextResponse.json(
      { error: 'Something went wrong processing your PDF. Please try again.' },
      { status: 500 }
    )
  } finally {
    // Always clean up tmp file
    if (tmpPath) await fs.unlink(tmpPath).catch(() => {})
  }
}


