'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface LoadingIngestionProps {
  fileName: string
  fileSizeBytes: number
}

const MESSAGES = [
  'Uploading your PDF...',
  'Checking for images and diagrams...',
  'Reading the content...',
  'Identifying key concepts...',
  'Writing your flashcards...',
  'Almost done...',
]

export default function LoadingIngestion({
  fileName,
  fileSizeBytes,
}: LoadingIngestionProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  const estimatedSeconds = Math.max(8, Math.ceil(fileSizeBytes / (500 * 1024)))

  // Cycle through messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Auto-progress: increment towards 90% based on estimated time
  useEffect(() => {
    const increment = 90 / estimatedSeconds

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90
        return Math.min(90, prev + increment)
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [estimatedSeconds])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
        {/* Spinner */}
        <div className="border-4 border-blue-500 border-t-transparent w-10 h-10 rounded-full animate-spin mx-auto" />

        {/* File name */}
        <p className="font-semibold mt-4 truncate text-gray-800">{fileName}</p>

        {/* Animated message */}
        <div className="h-6 mt-2 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-gray-500 absolute inset-x-0"
            >
              {MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mt-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percentage */}
        <p className="text-xs text-gray-400 mt-1 text-right">
          {Math.round(progress)}%
        </p>

        {/* Hint */}
        <p className="text-xs text-gray-300 mt-3">
          Usually takes 10–30 seconds
        </p>
      </div>
    </div>
  )
}
