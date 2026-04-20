// Gemini AI client and flashcard generation helpers
import { GoogleGenerativeAI } from '@google/generative-ai'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL = 'gemini-2.5-flash'

export interface RawCard {
  front: string
  back: string
  topic: string
  type: string
  source: string
}

const FLASHCARD_PROMPT = `You are a cognitive science expert designing flashcards for maximum long-term retention.

You have the full document — read all text, diagrams, charts, graphs, equations, and visual content.

For every major concept, create cards that test:
1. Definition — what is it exactly?
2. Application — a worked example or real use case
3. Relationship — how does it connect to another concept in this material?
4. Edge case — when does it NOT apply, or what is the common misconception?

Rules:
- Each card tests exactly ONE specific idea
- Questions must require genuine understanding, not pattern matching
- Answers should be concise — 1 to 3 sentences
- Generate between 15 and 25 cards depending on depth of material
- If you see a diagram or chart, create at least one card about what it shows

Return ONLY a raw JSON array. No markdown, no backticks, no explanation:
[{"front":"...","back":"...","topic":"...","type":"definition|application|relationship|edge_case","source":"text|visual|both"}]`

async function parseGeminiResponse(text: string, retryFn: () => Promise<string>): Promise<RawCard[]> {
  const clean = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    // Retry once with stricter instruction
    const retryText = await retryFn()
    const retryClean = retryText.replace(/```json|```/g, '').trim()
    try {
      return JSON.parse(retryClean)
    } catch {
      throw new Error('Failed to parse flashcard response from Gemini after retry')
    }
  }
}

// Vision path: for PDFs containing images/diagrams
export async function generateWithVision(pdfBuffer: Buffer): Promise<RawCard[]> {
  console.log('[gemini] using vision path, buffer size:', pdfBuffer.length)

  const model = genai.getGenerativeModel({ model: MODEL })

  // 90-second timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini request timed out after 90 seconds')), 90000)
  )

  async function callGemini(prompt: string): Promise<string> {
    let contentPart: any

    if (pdfBuffer.length < 15 * 1024 * 1024) {
      // Small PDF: inline base64
      contentPart = {
        inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') }
      }
    } else {
      // Large PDF: File API
      const { writeFile, unlink } = await import('fs/promises')
      const tmpPath = `/tmp/upload-${Date.now()}.pdf`
      await writeFile(tmpPath, pdfBuffer)

      let uploadedFile: any
      try {
        uploadedFile = await (genai as any).uploadFile(tmpPath, {
          mimeType: 'application/pdf',
          displayName: 'study-material.pdf',
        })

        let fileInfo = await (genai as any).getFile(uploadedFile.name)
        let polls = 0
        while (fileInfo.state === 'PROCESSING' && polls < 10) {
          await new Promise(r => setTimeout(r, 2000))
          fileInfo = await (genai as any).getFile(uploadedFile.name)
          polls++
        }

        if (fileInfo.state !== 'ACTIVE') throw new Error('File processing failed or timed out')
        contentPart = { fileData: { mimeType: 'application/pdf', fileUri: fileInfo.uri } }
      } finally {
        await unlink(tmpPath).catch(() => {})
        if (uploadedFile?.name) {
          await (genai as any).deleteFile(uploadedFile.name).catch(() => {})
        }
      }
    }

    const result = await Promise.race([
      model.generateContent([contentPart, { text: prompt }]),
      timeoutPromise,
    ])
    return (result as any).response.text()
  }

  const text = await callGemini(FLASHCARD_PROMPT)
  return parseGeminiResponse(text, () =>
    callGemini(FLASHCARD_PROMPT + '\n\nIMPORTANT: Return ONLY the JSON array. No other text.')
  )
}

// Text path: for text-only PDFs (cheaper, faster)
export async function generateWithText(textContent: string): Promise<RawCard[]> {
  console.log('[gemini] using text path, chars:', textContent.length)

  const model = genai.getGenerativeModel({ model: MODEL })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini request timed out after 90 seconds')), 90000)
  )

  async function callGemini(prompt: string): Promise<string> {
    const result = await Promise.race([
      model.generateContent([
        { text: `DOCUMENT TEXT:\n\n${textContent}` },
        { text: prompt },
      ]),
      timeoutPromise,
    ])
    return (result as any).response.text()
  }

  const text = await callGemini(FLASHCARD_PROMPT)
  return parseGeminiResponse(text, () =>
    callGemini(FLASHCARD_PROMPT + '\n\nIMPORTANT: Return ONLY the JSON array. No other text.')
  )
}
