'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { gsap } from 'gsap'
import LoadingIngestion from '@/components/LoadingIngestion'
import { PageTransition } from '@/components/PageTransition'

export default function HomePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ingestError, setIngestError] = useState<{ message: string; retryAfterSeconds?: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileSizeBytes, setFileSizeBytes] = useState(0)

  const [status, setStatus] = useState<'idle' | 'analyzing' | 'processing' | 'saving' | 'done' | 'error'>('idle')
  const [eta, setEta] = useState<number | null>(null)
  const [pdfInfo, setPdfInfo] = useState<{pageCount: number; type: string} | null>(null)

  const heroRef = useRef<HTMLDivElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const uploadZoneRef = useRef<HTMLDivElement>(null)
  const bottomLinkRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return
    if (!heroRef.current || !subtitleRef.current || !uploadZoneRef.current || !bottomLinkRef.current) return

    const tl = gsap.timeline()
    
    tl.fromTo(heroRef.current, 
      { opacity: 0, y: 30 }, 
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    )
    .fromTo(subtitleRef.current, 
      { opacity: 0, y: 30 }, 
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 
      0.15
    )
    .fromTo(uploadZoneRef.current, 
      { opacity: 0, y: 40, scale: 0.95 }, 
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" }, 
      0.3
    )
    .fromTo(bottomLinkRef.current, 
      { opacity: 0 }, 
      { opacity: 1, duration: 0.8, ease: "power3.out" }, 
      0.5
    )

    return () => {
      tl.kill()
    }
  }, [loading])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 2000)
    return () => clearTimeout(timer)
  }, [error])

  async function handleFile(file: File | undefined) {
    if (!file) return

    setError(null)
    setIngestError(null)

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
      let hasTerminalStatus = false

      const showIngestError = (message: string, retryAfterSeconds?: number) => {
        setIngestError({ message, retryAfterSeconds })
        setStatus('error')
        setLoading(true)
        setError(null)
        hasTerminalStatus = true
      }

      const handleStatusMessage = (data: any): boolean => {
        if (data.status === 'error') {
          showIngestError(
            data.error || 'Something went wrong processing your PDF.',
            data.retryAfterSeconds
          )
          return true
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
          hasTerminalStatus = true
          setStatus('done')
          setLoading(false)
          setIngestError(null)
          if (data.existing && data.deckId) {
            toast.success('You already have this deck!')
            router.push(`/decks/${data.deckId}`)
          } else if (data.deck?.id) {
            toast.success(`${data.deck.cards.length} flashcards created!`)
            router.push(`/decks/${data.deck.id}`)
          } else {
            setError('Upload finished but deck details were missing. Please retry.')
            setStatus('error')
          }
          return true
        }

        return false
      }

      const res = await fetch('/api/ingest', { method: 'POST', body: formData })

      if (!res.ok) {
        let json;
        try { json = await res.json() } catch(e) {}
        showIngestError(json?.error || 'Something went wrong processing your PDF.')
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
            if (handleStatusMessage(data)) return
          } catch (e) {
            console.error('JSON parse error from stream:', e)
          }
        }
      }

      // Some streams end without a trailing newline; process the final buffered line.
      const tail = bufferStr.trim()
      if (tail) {
        try {
          const data = JSON.parse(tail)
          if (handleStatusMessage(data)) return
        } catch (e) {
          console.error('JSON parse error from stream tail:', e)
        }
      }

      if (!hasTerminalStatus) {
        showIngestError('Upload was interrupted before completion. Please try again.')
      }
    } catch {
      setIngestError({ message: 'Something went wrong. Please try again.' })
      setStatus('error')
      setLoading(true)
      setError(null)
    }
  }

  if (loading) {
    return (
      <LoadingIngestion
        fileName={fileName}
        fileSizeBytes={fileSizeBytes}
        status={status}
        etaSeconds={eta}
        pdfInfo={pdfInfo}
        errorMessage={ingestError?.message || null}
        retryAfterSeconds={ingestError?.retryAfterSeconds ?? null}
        onCloseError={() => {
          const message = ingestError?.message || null
          setLoading(false)
          setStatus('idle')
          setEta(null)
          setPdfInfo(null)
          setIngestError(null)
          if (message) setError(message)
        }}
      />
    )
  }

  return (
    <PageTransition>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-glow { 0%,100% { filter: drop-shadow(0 0 0px #6c63ff) } 50% { filter: drop-shadow(0 0 12px rgba(108,99,255,0.5)) } }
        .icon-pulse { animation: pulse-glow 2.5s ease-in-out infinite; }
      `}} />

      {/* Decorative Background Blobs */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[-200px] left-[-200px] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(108,99,255,0.08)_0%,transparent_60%)]" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,210,255,0.05)_0%,transparent_60%)]" />
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10 w-full pt-[60px]">
        
        {/* Hero Text */}
        <div className="text-center mb-10 w-full">
          <div ref={heroRef} className="opacity-0">
            <h1 className="font-[family-name:var(--font-display)] text-5xl text-[#8888aa] font-normal leading-tight">
              Turn any PDF into
            </h1>
            <h2 className="font-[family-name:var(--font-display)] text-5xl text-[#f0f0ff] font-bold mt-2">
              a smart study deck
            </h2>
          </div>

          <div ref={subtitleRef} className="opacity-0 mt-6 flex justify-center">
            <p className="text-sm text-[#4a4a6a] tracking-[0.15em] uppercase flex items-center gap-3 font-medium">
              Powered by AI 
              <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff]"></span> 
              Driven by science 
              <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff]"></span> 
              Built for retention
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div ref={uploadZoneRef} className="opacity-0 w-full max-w-md mx-auto relative flex flex-col items-center">
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
            style={{
              borderColor: isDragging ? '#6c63ff' : 'rgba(108,99,255,0.25)',
              backgroundColor: isDragging ? 'rgba(108,99,255,0.05)' : '#0f0f1a',
              transition: 'border-color 250ms, background-color 250ms'
            }}
            className="w-full border-2 border-dashed rounded-[24px] px-8 py-12 text-center cursor-pointer flex flex-col items-center justify-center relative group hover:border-[#6c63ff] hover:bg-[rgba(108,99,255,0.02)]"
          >
            {/* Custom Styled Upload SVG */}
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 48 48" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg" 
              className={`mb-2 text-[#6c63ff] ${isDragging ? 'filter drop-shadow-[0_0_12px_rgba(108,99,255,0.8)]' : 'icon-pulse'}`}
            >
              <path d="M16 8H28L38 18V40C38 41.1046 37.1046 42 36 42H16C14.8954 42 14 41.1046 14 40V10C14 8.89543 14.8954 8 16 8Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M28 8V18H38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Star overlay attached to the bottom right of the document */}
              <path d="M38 32L39.5 35.5L43 37L39.5 38.5L38 42L36.5 38.5L33 37L36.5 35.5L38 32Z" fill="currentColor" stroke="#0f0f1a" strokeWidth="1" strokeLinejoin="round"/>
              {/* Internal abstract lines for 'doc' appearance */}
              <path d="M20 24H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 30H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            <h3 className="font-[family-name:var(--font-display)] text-xl text-[#f0f0ff] font-semibold mt-4">
              Drop your PDF here
            </h3>
            <p className="text-sm text-[#4a4a6a] mt-1">
              or click to browse
            </p>
            
            <div className="mt-4 flex items-center gap-2 text-xs text-[#4a4a6a] w-full max-w-[200px]">
              <div className="flex-1 h-[1px] bg-[#4a4a6a] opacity-30"></div>
              <span>Up to 20MB · Any study material</span>
              <div className="flex-1 h-[1px] bg-[#4a4a6a] opacity-30"></div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {/* Error state below zone */}
          {error && (
            <div className="mt-4 mx-auto bg-[rgba(255,77,109,0.1)] border border-[rgba(255,77,109,0.3)] text-[#ff4d6d] text-sm rounded-full px-4 py-2 inline-flex items-center justify-center w-full max-w-sm absolute -bottom-14">
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Bottom Link Row */}
        <div ref={bottomLinkRef} className="opacity-0 mt-12 flex flex-row items-center justify-between w-full max-w-md px-2">
          <Link
            href="/decks"
            className="text-sm text-[#4a4a6a] hover:text-[#f0f0ff] hover:underline transition-colors focus:outline-none"
          >
            View my decks →
          </Link>

          <div className="bg-[rgba(108,99,255,0.08)] border border-[rgba(108,99,255,0.15)] text-[11px] text-[#6c63ff] font-medium px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm selection:bg-transparent">
            Built with Gemini 2.5 <span className="text-[10px]">✦</span>
          </div>
        </div>

        {/* Page Footer */}
        <div className="absolute bottom-0 left-0 right-0 pb-4 text-center pointer-events-none opacity-80">
          <p className="text-xs text-[#4a4a6a]">
            Made with <span className="text-[#ff4d6d]">♥</span> for Cuemath
          </p>
        </div>

      </div>
    </PageTransition>
  )
}
