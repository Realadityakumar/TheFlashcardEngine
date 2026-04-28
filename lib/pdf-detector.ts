// PDF type detection — determines whether a PDF contains educational images
// that warrant vision-based processing, or is text-only.

import { join } from 'path'

// ---------------------------------------------------------------------------
// Polyfills for serverless environments (Vercel) where DOM APIs are missing.
// pdfjs-dist expects DOMMatrix, ImageData, and Path2D to exist globally.
// We only use pdfjs for text extraction and operator list analysis (no
// rendering), so minimal stubs are sufficient.
// ---------------------------------------------------------------------------
function ensurePolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      m11 = 1; m12 = 0; m13 = 0; m14 = 0
      m21 = 0; m22 = 1; m23 = 0; m24 = 0
      m31 = 0; m32 = 0; m33 = 1; m34 = 0
      m41 = 0; m42 = 0; m43 = 0; m44 = 1
      is2D = true; isIdentity = true

      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = this.m11 = init[0]
          this.b = this.m12 = init[1]
          this.c = this.m21 = init[2]
          this.d = this.m22 = init[3]
          this.e = this.m41 = init[4]
          this.f = this.m42 = init[5]
          this.is2D = true
          this.isIdentity = false
        }
      }

      multiply() { return new DOMMatrix() }
      inverse() { return new DOMMatrix() }
      translate() { return new DOMMatrix() }
      scale() { return new DOMMatrix() }
      rotate() { return new DOMMatrix() }
      transformPoint(p: any) { return p || { x: 0, y: 0, z: 0, w: 1 } }
      toFloat64Array() { return new Float64Array(16) }
      toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})` }

      static fromMatrix() { return new DOMMatrix() }
      static fromFloat64Array() { return new DOMMatrix() }
    }
  }

  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
      width: number
      height: number
      data: Uint8ClampedArray

      constructor(sw: number | Uint8ClampedArray, sh?: number, _settings?: any) {
        if (sw instanceof Uint8ClampedArray) {
          this.data = sw
          this.width = sh || 0
          this.height = sw.length / ((sh || 1) * 4)
        } else {
          this.width = sw
          this.height = sh || 0
          this.data = new Uint8ClampedArray(this.width * this.height * 4)
        }
      }
    }
  }

  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      constructor(_path?: string | Path2D) {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
  }
}

// ---------------------------------------------------------------------------
// Lazy pdfjs loader — polyfills must be set up BEFORE the module is evaluated,
// so we use dynamic import instead of a static top-level import.
// ---------------------------------------------------------------------------
type PdfjsLib = typeof import('pdfjs-dist')

let _pdfjs: PdfjsLib | null = null

async function getPdfjs(): Promise<PdfjsLib> {
  if (_pdfjs) return _pdfjs

  ensurePolyfills()

  // @ts-ignore -- legacy build has .d.mts types but TS resolves .mjs differently
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as PdfjsLib

  pdfjsLib.GlobalWorkerOptions.workerSrc = join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  )

  _pdfjs = pdfjsLib
  return pdfjsLib
}

const STANDARD_FONT_DATA_URL = join(
  process.cwd(),
  'node_modules/pdfjs-dist/standard_fonts/'
)

// ---------------------------------------------------------------------------
// Image hash helper — simple sum of first 100 byte values
// Used to deduplicate repeated template images (logos, headers, watermarks)
// ---------------------------------------------------------------------------
function hashImageBytes(data: Uint8Array): number {
  let sum = 0
  const len = Math.min(data.length, 100)
  for (let i = 0; i < len; i++) {
    sum += data[i]
  }
  return sum
}

// ---------------------------------------------------------------------------
// detectPDFType
// Walks every page's XObject dictionary and applies three filters to decide
// whether the PDF contains meaningful educational images.
// ---------------------------------------------------------------------------
export async function detectPDFType(
  buffer: Buffer,
  options: { maxPages?: number, skipPages?: number } = {}
): Promise<'vision' | 'text'> {
  const pdfjsLib = await getPdfjs()
  let doc: any

  try {
    const data = new Uint8Array(buffer)
    doc = await pdfjsLib.getDocument({ data, disableFontFace: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise
  } catch (err) {
    console.error('[pdf-detector] detectPDFType getDocument failed:', err)
    throw new Error('Invalid or corrupted PDF file')
  }

  const totalPages = doc.numPages
  const skip = options.skipPages || 0
  const startPage = Math.min(1 + skip, totalPages)
  
  let pagesToScan = totalPages - startPage + 1
  if (options.maxPages) {
    pagesToScan = Math.min(pagesToScan, options.maxPages)
  }
  const endPage = startPage + pagesToScan - 1

  // First pass — collect image metadata from every page
  const imageRecords: {
    hash: number
    width: number
    height: number
    yCenter: number    // vertical center as fraction of page height (0 = top)
    pageIndex: number
  }[] = []

  // Track which pages each hash appears on (for frequency filter)
  const hashToPages = new Map<number, Set<number>>()

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const pageHeight = viewport.height

    try {
      const operatorList = await page.getOperatorList()
      const { fnArray, argsArray } = operatorList

      for (let i = 0; i < fnArray.length; i++) {
        // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
        if (fnArray[i] !== 85 && fnArray[i] !== 82) continue

        const imgName = argsArray[i][0]
        if (!imgName) continue

        try {
          // Retrieve the image object from the page's objs store
          const imgData = await new Promise<{
            width: number
            height: number
            data?: Uint8Array
          }>((resolve, reject) => {
            // page.objs.get may return synchronously or call a callback
            const result = page.objs.get(imgName, (obj: unknown) => {
              resolve(obj as { width: number; height: number; data?: Uint8Array })
            })
            if (result && typeof result === 'object' && 'width' in result) {
              resolve(result as { width: number; height: number; data?: Uint8Array })
            }
            // Timeout fallback
            setTimeout(() => reject(new Error('timeout')), 2000)
          })

          if (!imgData || !imgData.width || !imgData.height) continue

          // Filter 1 — Size: skip tiny images (icons, bullets, logos)
          if (imgData.width <= 100 || imgData.height <= 100) continue

          // Compute hash for frequency analysis
          const hash = imgData.data
            ? hashImageBytes(imgData.data)
            : imgData.width * 1000 + imgData.height

          // Estimate vertical center position
          // Use transform matrix if available; fall back to page center
          let yCenter = 0.5
          if (i > 0 && fnArray[i - 1] === 12) {
            // OPS.transform = 12 → [a, b, c, d, e, f] where f = y position
            const transform = argsArray[i - 1]
            if (transform && transform.length >= 6) {
              const yPos = transform[5] as number
              const imgHeight = Math.abs(transform[3] as number)
              yCenter = 1 - (yPos + imgHeight / 2) / pageHeight
            }
          }

          imageRecords.push({
            hash,
            width: imgData.width,
            height: imgData.height,
            yCenter,
            pageIndex: pageNum,
          })

          if (!hashToPages.has(hash)) hashToPages.set(hash, new Set())
          hashToPages.get(hash)!.add(pageNum)
        } catch {
          // Individual image extraction failed — skip and continue
          continue
        }
      }
    } catch {
      // Entire page operator list failed — skip page
      continue
    }
  }

  // Apply all three filters
  for (const img of imageRecords) {
    // Filter 1 — Size (already applied above, but double-check)
    if (img.width <= 100 || img.height <= 100) continue

    // Filter 2 — Position: vertical center must be between 8% and 92%
    if (img.yCenter < 0.08 || img.yCenter > 0.92) continue

    // Filter 3 — Frequency: skip template elements appearing on >30% of pages
    const pagesWithHash = hashToPages.get(img.hash)?.size ?? 0
    if (pagesToScan > 1 && pagesWithHash / pagesToScan > 0.3) continue

    // Image passed all three filters — this PDF has educational images
    return 'vision'
  }

  return 'text'
}

// ---------------------------------------------------------------------------
// extractTextFromPDF
// Extracts text content from every page, joining with double newlines.
// Skips pages that fail to parse.
// ---------------------------------------------------------------------------
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await getPdfjs()
  let doc: any

  try {
    const data = new Uint8Array(buffer)
    doc = await pdfjsLib.getDocument({ data, disableFontFace: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise
  } catch (err) {
    console.error('[pdf-detector] extractText getDocument failed:', err)
    throw new Error('Invalid or corrupted PDF file')
  }

  const pages: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = (content.items as Array<{ str?: string }>)
        .filter((item: any): item is { str: string } => typeof item.str === 'string')
        .map((item: { str: string }) => item.str)
        .join(' ')
        .trim()

      if (pageText) pages.push(pageText)
    } catch {
      // Page failed to parse — skip and continue
      continue
    }
  }

  return pages.join('\n\n')
}

// ---------------------------------------------------------------------------
// getPDFPageCount
// Returns the total number of pages in the PDF buffer.
// ---------------------------------------------------------------------------
export async function getPDFPageCount(buffer: Buffer): Promise<number> {
  const pdfjsLib = await getPdfjs()
  const data = new Uint8Array(buffer)
  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise
  return pdf.numPages
}

// Threshold: chunk anything over 40 pages
export const CHUNK_THRESHOLD = 40
export const CHUNK_SIZE = 40  // Chunk size aligned with threshold

export async function extractTextByChunks(
  buffer: Buffer,
  chunkSize: number = 40
): Promise<{ chunkIndex: number; startPage: number; endPage: number; text: string }[]> {
  const pdfjsLib = await getPdfjs()

  const data = new Uint8Array(buffer)
  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise
  const totalPages = pdf.numPages
  const chunks = []

  for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
    const endPage = Math.min(startPage + chunkSize - 1, totalPages)
    let chunkText = ''

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items.map((item: any) => item.str).join(' ')
      chunkText += `\n\n--- Page ${pageNum} ---\n${pageText}`
    }

    chunks.push({
      chunkIndex: chunks.length,
      startPage,
      endPage,
      text: chunkText.trim()
    })
  }

  return chunks
}
