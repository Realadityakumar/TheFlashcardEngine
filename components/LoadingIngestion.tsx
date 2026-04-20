'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoadingIngestionProps {
  fileName: string
  fileSizeBytes: number
  status: 'idle' | 'analyzing' | 'processing' | 'saving' | 'done' | 'error'
  etaSeconds: number | null
  pdfInfo: { pageCount: number; type: string } | null
  errorMessage?: string | null
  retryAfterSeconds?: number | null
  onCloseError?: () => void
}

export default function LoadingIngestion({
  fileName,
  fileSizeBytes,
  status,
  etaSeconds,
  pdfInfo,
  errorMessage,
  retryAfterSeconds,
  onCloseError,
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

  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="glass max-w-sm w-full mx-4 rounded-[24px] px-[28px] py-[30px] text-center border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)]">
          <div className="text-3xl">⚠️</div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#f0f0ff] mt-3">
            Upload failed
          </h2>
          <p className="text-sm text-[#ff9db0] mt-2">
            {errorMessage || 'Something went wrong while processing your PDF.'}
          </p>
          {typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0 && (
            <p className="text-xs text-[#ffb3c3] mt-2">
              Try again in about {retryAfterSeconds}s.
            </p>
          )}
          {onCloseError && (
            <button
              onClick={onCloseError}
              className="mt-5 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #00d2ff)' }}
            >
              Back to upload
            </button>
          )}
        </div>
      </div>
    )
  }

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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(8px)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes custom-spin { to { transform: rotate(360deg) } }
        @keyframes custom-spin-reverse { to { transform: translate(-50%, -50%) rotate(-360deg) } }
        .spinner-outer {
          animation: custom-spin 1.2s linear infinite;
        }
        .spinner-inner {
          animation: custom-spin-reverse 0.9s linear infinite;
        }
      `}} />

      <div className="glass max-w-sm w-full mx-4 rounded-[24px] px-[32px] py-[40px] text-center shadow-[0_0_40px_rgba(108,99,255,0.1)]">
        
        {/* Spinner */}
        <div className="relative w-[44px] h-[44px] mx-auto">
          <div 
            className="spinner-outer absolute inset-0 rounded-full"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderTopColor: '#6c63ff',
              borderRightColor: 'rgba(108,99,255,0.3)'
            }}
          />
          <div 
            className="spinner-inner absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: '28px',
              height: '28px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderTopColor: '#00d2ff',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>

        {/* File name */}
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[#f0f0ff] mt-5 truncate" title={fileName}>
          {fileName}
        </p>

        {/* Status message */}
        <div className="min-h-[24px] mt-2 relative overflow-hidden flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={mainMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-[#8888aa] absolute w-full"
            >
              {mainMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#161625] rounded-[99px] h-[3px] mt-5 overflow-hidden">
          <div 
            className="h-[3px] rounded-[99px]"
            style={{ 
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #6c63ff, #00d2ff)',
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
        
        {/* Progress text */}
        <p className="font-[family-name:var(--font-mono)] text-xs text-[#4a4a6a] mt-2 text-right">
          {Math.round(progressPercent)}%
        </p>

        {/* Hint */}
        <p className="text-xs text-[#4a4a6a] mt-4">
          {subMessage}
        </p>
      </div>
    </div>
  )
}
