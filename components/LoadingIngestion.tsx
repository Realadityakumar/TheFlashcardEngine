'use client'

import { useEffect, useState } from 'react'

interface LoadingIngestionProps {
  fileName: string
  fileSizeBytes: number
  status: 'idle' | 'analyzing' | 'processing' | 'saving' | 'done' | 'error'
  etaSeconds: number | null
  pdfInfo: { pageCount: number; type: string } | null
}

export default function LoadingIngestion({
  fileName,
  fileSizeBytes,
  status,
  etaSeconds,
  pdfInfo,
}: LoadingIngestionProps) {
  const [countdown, setCountdown] = useState<number | null>(null)

  // Countdown timer for ETA using an effect
  useEffect(() => {
    if (etaSeconds !== null && countdown === null) {
      setCountdown(etaSeconds)
    }
  }, [etaSeconds, countdown])

  useEffect(() => {
    if (countdown === null || countdown <= 0 || status === 'saving') return
    const timer = setInterval(() => setCountdown(prev => prev! - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown, status])

  let mainMessage = 'Preparing document...'
  let subMessage = ''
  let progressPercent = 0

  if (status === 'analyzing') {
    mainMessage = 'Analyzing PDF...'
    subMessage = 'Scanning pages and detecting document format...'
    progressPercent = 10
  } else if (status === 'processing' && pdfInfo) {
    const mode = pdfInfo.type === 'vision' ? 'Vision AI' : 'Text AI'
    mainMessage = `Reading ${pdfInfo.pageCount} pages using ${mode}...`
    subMessage = countdown !== null 
      ? `Estimated time remaining: ~${countdown}s` 
      : 'Generating flashcards...'
      
    if (etaSeconds && countdown !== null) {
      // Map progress from 10% up to 90% during processing phase
      const fractionComplete = (etaSeconds - countdown) / etaSeconds
      progressPercent = 10 + Math.max(0, Math.min(1, fractionComplete)) * 80
    } else {
      progressPercent = 50
    }
  } else if (status === 'saving') {
    mainMessage = 'Saving Flashcards...'
    subMessage = 'Almost done!'
    progressPercent = 95
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl transform transition-all scale-100">
        {/* File name */}
        <p className="font-semibold text-lg text-gray-800 truncate mb-1" title={fileName}>
          {fileName}
        </p>

        {/* Dynamic Status */}
        <p className="text-blue-600 font-medium text-sm mb-2 mt-2">{mainMessage}</p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-3 mt-4 overflow-hidden relative">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Honest Message / ETA */}
        <p className="text-sm text-gray-500 min-h-[1.5rem]">
          {subMessage}
        </p>
      </div>
    </div>
  )
}

