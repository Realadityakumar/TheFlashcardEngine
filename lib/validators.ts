// Zod schemas and request validators
export interface ValidatedCard {
  front: string
  back: string
  topic: string
  type: 'definition' | 'application' | 'relationship' | 'edge_case'
  source: 'text' | 'visual' | 'both'
}

// Server-side PDF validation. Runs before any processing.
export async function validatePDFUpload(
  buffer: Buffer,
  fileName: string,
  fileSizeBytes: number
): Promise<{ valid: boolean; error?: string }> {

  if (fileSizeBytes > 20 * 1024 * 1024)
    return { valid: false, error: 'File too large. Maximum size is 20MB.' }

  if (!fileName.toLowerCase().endsWith('.pdf'))
    return { valid: false, error: 'Only PDF files are accepted.' }

  // Magic bytes check — catches renamed executables
  // Every valid PDF starts with the bytes: %PDF
  const magic = buffer.slice(0, 4).toString('ascii')
  if (magic !== '%PDF')
    return { valid: false, error: 'Invalid file. Please upload a valid PDF.' }

  return { valid: true }
}

// Flashcard output validation. Runs after Gemini responds.
// Guards against malformed JSON, prompt injection, and out-of-range content.
export function validateFlashcards(rawCards: any[]): ValidatedCard[] {
  if (!Array.isArray(rawCards)) return []

  const VALID_TYPES = ['definition', 'application', 'relationship', 'edge_case']
  const VALID_SOURCES = ['text', 'visual', 'both']
  const URL_RE = /https?:\/\//i
  const INJECTION_RE = /ignore previous|pretend|act as|you are now|system prompt/i

  return rawCards
    .filter(c => {
      if (typeof c?.front !== 'string' || typeof c?.back !== 'string') return false
      if (c.front.length < 10 || c.front.length > 300) return false
      if (c.back.length < 10 || c.back.length > 600) return false
      if (URL_RE.test(c.front) || URL_RE.test(c.back)) return false
      if (INJECTION_RE.test(c.front) || INJECTION_RE.test(c.back)) return false
      return true
    })
    .map(c => ({
      front: c.front.trim(),
      back: c.back.trim(),
      topic: typeof c.topic === 'string' && c.topic.trim() ? c.topic.trim() : 'General',
      type: VALID_TYPES.includes(c.type) ? c.type : 'definition',
      source: VALID_SOURCES.includes(c.source) ? c.source : 'text',
    }))
}
