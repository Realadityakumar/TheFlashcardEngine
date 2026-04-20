// Gemini AI client and flashcard generation helpers
import { GoogleGenerativeAI } from '@google/generative-ai'

function getGenAI() {
  // Instantiate dynamically so it always pulls the freshest process.env
  // (Prevents stale API keys from being locked in during hot-reloads)
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
}

const MODEL = 'gemini-2.5-flash'
const DEFAULT_RETRY_WAIT_SECONDS = 15
const MAX_RATE_LIMIT_RETRIES = 1

type GeminiErrorLike = {
  status?: number
  message?: string
  errorDetails?: unknown
}

type GeminiQuotaViolation = {
  quotaId?: string
  quotaMetric?: string
  quotaValue?: string
}

type GeminiErrorDetail = {
  retryDelay?: string
  violations?: GeminiQuotaViolation[]
}

type GeminiFileRef = {
  name: string
}

type GeminiUploadedFileInfo = {
  uri: string
  state: string
}

type GeminiFileClient = {
  uploadFile: (path: string, options: { mimeType: string; displayName: string }) => Promise<GeminiFileRef>
  getFile: (name: string) => Promise<GeminiUploadedFileInfo>
  deleteFile: (name: string) => Promise<void>
}

type GeminiGenerateResult = {
  response?: {
    text?: () => string
  }
}

export class GeminiRateLimitError extends Error {
  retryAfterSeconds?: number
  isDailyQuota: boolean
  quotaId?: string
  quotaMetric?: string

  constructor(
    message: string,
    options: {
      retryAfterSeconds?: number
      isDailyQuota?: boolean
      quotaId?: string
      quotaMetric?: string
    } = {}
  ) {
    super(message)
    this.name = 'GeminiRateLimitError'
    this.retryAfterSeconds = options.retryAfterSeconds
    this.isDailyQuota = options.isDailyQuota ?? false
    this.quotaId = options.quotaId
    this.quotaMetric = options.quotaMetric
  }
}

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function asGeminiErrorLike(err: unknown): GeminiErrorLike {
  if (typeof err === 'object' && err !== null) return err as GeminiErrorLike
  return {}
}

function asGeminiErrorDetails(errorDetails: unknown): GeminiErrorDetail[] {
  return Array.isArray(errorDetails) ? (errorDetails as GeminiErrorDetail[]) : []
}

function extractResultText(result: unknown): string {
  const maybeResult = result as GeminiGenerateResult
  const textFn = maybeResult?.response?.text

  if (typeof textFn === 'function') {
    return textFn()
  }

  throw new Error('Gemini response was missing text output')
}

function parseRetryAfterSeconds(err: unknown): number | undefined {
  const errorLike = asGeminiErrorLike(err)
  const details = asGeminiErrorDetails(asGeminiErrorLike(err).errorDetails)

  for (const detail of details) {
    if (typeof detail.retryDelay === 'string') {
      const match = detail.retryDelay.match(/(\d+(?:\.\d+)?)s/)
      if (match) return Math.max(1, Math.ceil(Number(match[1])))
    }
  }

  const message = typeof errorLike.message === 'string' ? errorLike.message : ''
  const msgMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i)
  if (msgMatch) return Math.max(1, Math.ceil(Number(msgMatch[1])))

  return undefined
}

function isRateLimitError(err: unknown): boolean {
  const errorLike = asGeminiErrorLike(err)
  const status = Number(errorLike.status || 0)
  const message = String(errorLike.message || '').toLowerCase()

  return status === 429 || status === 503 || message.includes('429') || message.includes('503') || message.includes('quota')
}

function isDailyQuotaViolation(err: unknown): boolean {
  const details = asGeminiErrorDetails(asGeminiErrorLike(err).errorDetails)

  for (const detail of details) {
    if (!Array.isArray(detail.violations)) continue
    for (const violation of detail.violations) {
      if (typeof violation.quotaId === 'string' && violation.quotaId.toLowerCase().includes('perday')) {
        return true
      }
    }
  }

  return false
}

type QuotaScope = 'per_day' | 'per_minute' | 'per_hour' | 'unknown'

function detectQuotaScope(err: unknown): { scope: QuotaScope; quotaId?: string; quotaMetric?: string } {
  const details = asGeminiErrorDetails(asGeminiErrorLike(err).errorDetails)

  for (const detail of details) {
    if (!Array.isArray(detail.violations)) continue
    for (const violation of detail.violations) {
      const quotaId = violation.quotaId
      const quotaMetric = violation.quotaMetric
      const normalized = String(quotaId || '').toLowerCase()

      if (normalized.includes('perday')) return { scope: 'per_day', quotaId, quotaMetric }
      if (normalized.includes('perminute')) return { scope: 'per_minute', quotaId, quotaMetric }
      if (normalized.includes('perhour')) return { scope: 'per_hour', quotaId, quotaMetric }

      if (quotaId || quotaMetric) return { scope: 'unknown', quotaId, quotaMetric }
    }
  }

  return { scope: 'unknown' }
}

function toRateLimitError(err: unknown): GeminiRateLimitError {
  const quota = detectQuotaScope(err)
  const retryAfterSeconds = parseRetryAfterSeconds(err)
  const dailyQuota = quota.scope === 'per_day' || isDailyQuotaViolation(err)

  if (quota.scope === 'per_minute') {
    return new GeminiRateLimitError(
      'Gemini per-minute rate limit reached. Wait about 60 seconds and try again.',
      {
        retryAfterSeconds: retryAfterSeconds ?? 60,
        isDailyQuota: false,
        quotaId: quota.quotaId,
        quotaMetric: quota.quotaMetric,
      }
    )
  }

  if (dailyQuota) {
    return new GeminiRateLimitError(
      'Gemini daily quota reached for this API key/model. Try again later or use a different key/model.',
      {
        retryAfterSeconds,
        isDailyQuota: true,
        quotaId: quota.quotaId,
        quotaMetric: quota.quotaMetric,
      }
    )
  }

  if (quota.scope === 'per_hour') {
    return new GeminiRateLimitError('Gemini hourly quota reached. Please retry later.', {
      retryAfterSeconds,
      isDailyQuota: false,
      quotaId: quota.quotaId,
      quotaMetric: quota.quotaMetric,
    })
  }

  return new GeminiRateLimitError('Gemini is rate-limiting requests. Please retry shortly.', {
    retryAfterSeconds,
    isDailyQuota: false,
    quotaId: quota.quotaId,
    quotaMetric: quota.quotaMetric,
  })
}

function parseGeminiResponse(text: string): RawCard[] {
  const clean = text.replace(/```json|```/gi, '').trim()
  const candidates: string[] = [clean]

  const arrayStart = clean.indexOf('[')
  const arrayEnd = clean.lastIndexOf(']')
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(clean.slice(arrayStart, arrayEnd + 1).trim())
  }

  const objectStart = clean.indexOf('{')
  const objectEnd = clean.lastIndexOf('}')
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(clean.slice(objectStart, objectEnd + 1).trim())
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return parsed as RawCard[]
      if (parsed && typeof parsed === 'object') {
        const maybeCards = (parsed as { cards?: unknown }).cards
        if (Array.isArray(maybeCards)) return maybeCards as RawCard[]
      }
    } catch {
      // Try next parse candidate.
    }
  }

  throw new Error('Failed to parse flashcard response from Gemini')
}

// Vision path: for PDFs containing images/diagrams
export async function generateWithVision(pdfBuffer: Buffer): Promise<RawCard[]> {
  console.log('[gemini] using vision path, buffer size:', pdfBuffer.length)

  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: MODEL })

  // 90-second timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini request timed out after 90 seconds')), 90000)
  )
  const fileClient = genai as unknown as GeminiFileClient

  async function callGemini(prompt: string, retries = MAX_RATE_LIMIT_RETRIES): Promise<string> {
    let contentPart:
      | { inlineData: { mimeType: 'application/pdf'; data: string } }
      | { fileData: { mimeType: 'application/pdf'; fileUri: string } }

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

      let uploadedFile: GeminiFileRef | null = null
      try {
        uploadedFile = await fileClient.uploadFile(tmpPath, {
          mimeType: 'application/pdf',
          displayName: 'study-material.pdf',
        })

        let fileInfo = await fileClient.getFile(uploadedFile.name)
        let polls = 0
        while (fileInfo.state === 'PROCESSING' && polls < 10) {
          await sleep(2000)
          fileInfo = await fileClient.getFile(uploadedFile.name)
          polls++
        }

        if (fileInfo.state !== 'ACTIVE') throw new Error('File processing failed or timed out')
        contentPart = { fileData: { mimeType: 'application/pdf', fileUri: fileInfo.uri } }
      } finally {
        await unlink(tmpPath).catch(() => { })
        if (uploadedFile && uploadedFile.name) {
          await fileClient.deleteFile(uploadedFile.name).catch(() => { })
        }
      }
    }

    try {
      const result = await Promise.race([
        model.generateContent([contentPart, { text: prompt }]),
        timeoutPromise,
      ])
      return extractResultText(result)
    } catch (err: unknown) {
      if (isRateLimitError(err)) {
        const rateLimitError = toRateLimitError(err)
        const retryAfter = rateLimitError.retryAfterSeconds ?? DEFAULT_RETRY_WAIT_SECONDS

        if (retries > 0 && !rateLimitError.isDailyQuota) {
          console.warn(`[gemini] vision path rate-limited. Retrying in ${retryAfter}s... (${retries} left)`)
          await sleep(retryAfter * 1000)
          return callGemini(prompt, retries - 1)
        }

        throw rateLimitError
      }

      throw err
    }
  }

  const text = await callGemini(FLASHCARD_PROMPT)
  return parseGeminiResponse(text)
}

// Text path: for text-only PDFs (cheaper, faster)
export async function generateWithText(textContent: string, customPrompt: string = FLASHCARD_PROMPT): Promise<RawCard[]> {
  console.log('[gemini] using text path, chars:', textContent.length)

  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: MODEL })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini request timed out after 90 seconds')), 90000)
  )

  async function callGemini(prompt: string, retries = MAX_RATE_LIMIT_RETRIES): Promise<string> {
    try {
      const result = await Promise.race([
        model.generateContent([
          { text: `DOCUMENT TEXT:\n\n${textContent}` },
          { text: prompt },
        ]),
        timeoutPromise,
      ])
      return extractResultText(result)
    } catch (err: unknown) {
      if (isRateLimitError(err)) {
        const rateLimitError = toRateLimitError(err)
        const retryAfter = rateLimitError.retryAfterSeconds ?? DEFAULT_RETRY_WAIT_SECONDS

        if (retries > 0 && !rateLimitError.isDailyQuota) {
          console.warn(`[gemini] text path rate-limited. Retrying in ${retryAfter}s... (${retries} left)`)
          await sleep(retryAfter * 1000)
          return callGemini(prompt, retries - 1)
        }

        throw rateLimitError
      }

      console.error('[gemini] Request failed immediately:', err)
      throw err
    }
  }

  const text = await callGemini(customPrompt)
  return parseGeminiResponse(text)
}

function deduplicateCards(cards: RawCard[]): RawCard[] {
  const seen = new Set<string>()
  return cards.filter(card => {
    // Normalize: lowercase, remove punctuation, take first 60 chars
    const key = card.front.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60).trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function capByTopic(cards: RawCard[], maxPerTopic: number = 4): RawCard[] {
  const topicCounts: Record<string, number> = {}
  return cards.filter(card => {
    const topic = card.topic.toLowerCase()
    topicCounts[topic] = (topicCounts[topic] || 0) + 1
    return topicCounts[topic] <= maxPerTopic
  })
}

export async function generateFromChunks(
  chunks: { chunkIndex: number; startPage: number; endPage: number; text: string }[]
): Promise<RawCard[]> {
  const allCards: RawCard[] = []

  // Process chunks sequentially — not in parallel
  // Parallel would hit Gemini rate limits and spike costs
  for (const chunk of chunks) {
    console.log(`[gemini] processing chunk ${chunk.chunkIndex + 1}/${chunks.length}\n                 pages ${chunk.startPage}-${chunk.endPage}`)

    // Add page context to the prompt so cards reference the right section
    const chunkPrompt = `
      This is pages ${chunk.startPage} to ${chunk.endPage} of a larger document.
      Generate 10-15 flashcards covering only the content in these pages.
      Focus on the most important concepts. Do not repeat concepts already
      likely covered in earlier chapters.

      Return ONLY a JSON array:
      [{"front":"...","back":"...","topic":"...","type":"...","source":"text"}]
    `

    try {
      const cards = await generateWithText(chunk.text, chunkPrompt)
      allCards.push(...cards)
    } catch (err) {
      console.error(`[gemini] chunk ${chunk.chunkIndex} failed:`, err)
      // Continue with remaining chunks — partial results are better than none
    }

    // Small delay between chunks to avoid free-tier rapid limits
    if (chunk.chunkIndex < chunks.length - 1) {
      await sleep(2000)
    }
  }

  return capByTopic(deduplicateCards(allCards))
}
