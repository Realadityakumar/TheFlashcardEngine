// PDF type detection — determines whether a PDF contains educational images
// that warrant vision-based processing, or is text-only.

// @ts-ignore -- legacy build has .d.mts types but TS resolves .mjs differently
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { join } from 'path'

// Point to the legacy worker for Node.js server-side usage
pdfjsLib.GlobalWorkerOptions.workerSrc = join(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
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
export async function detectPDFType(buffer: Buffer): Promise<'vision' | 'text'> {
  let doc: pdfjsLib.PDFDocumentProxy

  try {
    const data = new Uint8Array(buffer)
    doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise
  } catch (err) {
    console.error('[pdf-detector] detectPDFType getDocument failed:', err)
    throw new Error('Invalid or corrupted PDF file')
  }

  const totalPages = doc.numPages

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

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
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
    if (totalPages > 1 && pagesWithHash / totalPages > 0.3) continue

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
  let doc: pdfjsLib.PDFDocumentProxy

  try {
    const data = new Uint8Array(buffer)
    doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise
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
        .filter((item): item is { str: string } => typeof item.str === 'string')
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
