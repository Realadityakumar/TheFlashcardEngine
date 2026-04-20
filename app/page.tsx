'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import LoadingIngestion from '@/components/LoadingIngestion'
import { PageTransition } from '@/components/PageTransition'

export default function HomePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileSizeBytes, setFileSizeBytes] = useState(0)

  const [status, setStatus] = useState<'idle' | 'analyzing' | 'processing' | 'saving' | 'done' | 'error'>('idle')
  const [eta, setEta] = useState<number | null>(null)
  const [pdfInfo, setPdfInfo] = useState<{pageCount: number; type: string} | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return

    setError(null)

    // Client-side checks
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20MB.')
      return
    }

    setFileName(file.name)
    setFileSizeBytes(file.size)
    setLoading(true)
    setStatus('analyzing')
    setEta(null)
    setPdfInfo(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('title', file.name.replace(/\.pdf$/i, ''))

      const res = await fetch('/api/ingest', { method: 'POST', body: formData })

      if (!res.ok) {
        let json;
        try { json = await res.json() } catch(e) {}
        setError(json?.error || 'Something went wrong processing your PDF.')
        setLoading(false)
        setStatus('idle')
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let bufferStr = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        bufferStr += decoder.decode(value, { stream: true })
        const lines = bufferStr.split('\n')
        
        // Keep the last partial line in the buffer
        bufferStr = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            
            if (data.status === 'error') {
              setError(data.error)
              setLoading(false)
              setStatus('idle')
              return
            }

            if (data.status === 'analyzing') {
              setStatus('analyzing')
            } else if (data.status === 'processing') {
              setStatus('processing')
              setEta(data.estimatedSeconds)
              setPdfInfo({ pageCount: data.pageCount, type: data.pdfType })
            } else if (data.status === 'saving') {
              setStatus('saving')
            } else if (data.status === 'done') {
              setStatus('done')
              if (data.existing) {
                toast.success('You already have this deck!')
                router.push(`/decks/${data.deckId}`)
              } else if (data.deck) {
                toast.success(`${data.deck.cards.length} flashcards created!`)
                router.push(`/decks/${data.deck.id}`)
              }
            }
          } catch (e) {
            console.error('JSON parse error from stream:', e)
          }
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      setStatus('idle')
    }
  }

  if (loading) {
    return <LoadingIngestion fileName={fileName} fileSizeBytes={fileSizeBytes} status={status} etaSeconds={eta} pdfInfo={pdfInfo} />
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-4xl font-bold text-gray-900">Flashcard Engine</h1>
        <p className="text-xl text-gray-400 mt-2">
          Turn any PDF into smart flashcards in seconds
        </p>

        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={`
            mt-10 w-full max-w-lg border-2 border-dashed rounded-2xl p-16
            text-center cursor-pointer transition-colors
            ${
              isDragging
                ? 'border-blue-400 bg-blue-50/30'
                : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'
            }
          `}
        >
          {/* Upload icon */}
          <svg
            className="w-10 h-10 mx-auto text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16V4m0 0L7 9m5-5l5 5"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            />
          </svg>

          <p className="text-lg font-medium mt-4 text-gray-700">
            Drop your PDF here
          </p>
          <p className="text-sm text-gray-400">or click to browse</p>
          <p className="text-xs text-gray-300 mt-1">
            Supports any PDF up to 20MB
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>

        {/* Error message */}
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        {/* View decks link */}
        <Link
          href="/decks"
          className="text-blue-500 text-sm mt-8 hover:underline"
        >
          View my decks →
        </Link>
      </div>
    </PageTransition>
  )
}
