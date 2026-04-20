'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { previewIntervals } from '@/lib/sm2'

interface RatingButtonsProps {
  onRate: (rating: 0 | 1 | 2 | 3) => void
  disabled: boolean
  cardEaseFactor: number
  cardInterval: number
  cardRepetitions: number
}

function fmt(days: number, rating: 0 | 1 | 2 | 3): string {
  // Again (0) re-queues in session — show that context instead of "1 day"
  if (rating === 0) return '< 10min'
  if (days <= 0) return '< 1d'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

const buttons = [
  { rating: 0 as const, label: 'Again', key: '1', bg: 'bg-red-500', hover: 'hover:bg-red-600' },
  { rating: 1 as const, label: 'Hard',  key: '2', bg: 'bg-orange-500', hover: 'hover:bg-orange-600' },
  { rating: 2 as const, label: 'Good',  key: '3', bg: 'bg-blue-500', hover: 'hover:bg-blue-600' },
  { rating: 3 as const, label: 'Easy',  key: '4', bg: 'bg-green-500', hover: 'hover:bg-green-600' },
]

export default function RatingButtons({
  onRate,
  disabled,
  cardEaseFactor,
  cardInterval,
  cardRepetitions,
}: RatingButtonsProps) {
  const previews = previewIntervals({
    easeFactor: cardEaseFactor,
    interval: cardInterval,
    repetitions: cardRepetitions,
  })

  // Keyboard shortcuts: 1=Again, 2=Hard, 3=Good, 4=Easy
  useEffect(() => {
    if (disabled) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case '1': onRate(0); break
        case '2': onRate(1); break
        case '3': onRate(2); break
        case '4': onRate(3); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, onRate])

  return (
    <div className="flex gap-2 w-full">
      {buttons.map(({ rating, label, key, bg, hover }) => (
        <div key={rating} className="flex-1 flex flex-col items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              w-full min-h-[56px] rounded-xl text-white font-medium
              flex flex-col items-center justify-center
              ${bg} ${hover}
              transition-colors
              ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
            `}
          >
            <span>{label}</span>
            <span className="text-xs opacity-80">{fmt(previews[rating], rating)}</span>
          </motion.button>
          <span className="text-xs text-gray-400">{key}</span>
        </div>
      ))}
    </div>
  )
}

