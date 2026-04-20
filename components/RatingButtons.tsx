'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface RatingButtonsProps {
  onRate: (rating: 0 | 1 | 2 | 3) => void
  disabled: boolean
}

const buttons = [
  { 
    rating: 0 as const, 
    label: 'Again', 
    keyHint: '1', 
    colors: 'text-[#ff4d6d] bg-[#ff4d6d]/10 border-[#ff4d6d]/20 hover:bg-[#ff4d6d]/15 hover:border-[#ff4d6d]/40 hover:shadow-[0_4px_20px_rgba(255,77,109,0.15)]',
    keyColor: 'text-[#ff4d6d]/50 bg-[#ff4d6d]/10 border-[#ff4d6d]/20'
  },
  { 
    rating: 1 as const, 
    label: 'Hard', 
    keyHint: '2', 
    colors: 'text-[#ffb547] bg-[#ffb547]/10 border-[#ffb547]/20 hover:bg-[#ffb547]/15 hover:border-[#ffb547]/40 hover:shadow-[0_4px_20px_rgba(255,181,71,0.15)]',
    keyColor: 'text-[#ffb547]/50 bg-[#ffb547]/10 border-[#ffb547]/20'
  },
  { 
    rating: 2 as const, 
    label: 'Good', 
    keyHint: '3', 
    colors: 'text-[#6c63ff] bg-[#6c63ff]/10 border-[#6c63ff]/20 hover:bg-[#6c63ff]/15 hover:border-[#6c63ff]/40 hover:shadow-[0_4px_20px_rgba(108,99,255,0.15)]',
    keyColor: 'text-[#6c63ff]/50 bg-[#6c63ff]/10 border-[#6c63ff]/20'
  },
  { 
    rating: 3 as const, 
    label: 'Easy', 
    keyHint: '4', 
    colors: 'text-[#00e5a0] bg-[#00e5a0]/10 border-[#00e5a0]/20 hover:bg-[#00e5a0]/15 hover:border-[#00e5a0]/40 hover:shadow-[0_4px_20px_rgba(0,229,160,0.15)]',
    keyColor: 'text-[#00e5a0]/50 bg-[#00e5a0]/10 border-[#00e5a0]/20'
  },
]

export default function RatingButtons({
  onRate,
  disabled,
}: RatingButtonsProps) {
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
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-center gap-3 text-[11px] font-medium tracking-wide uppercase text-[#4a4a6a]/70">
        <span>Review Soon</span>
        <div className="w-1 h-1 rounded-full bg-[#4a4a6a]/30" />
        <span>Schedule Later</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full font-[family-name:var(--font-body)]">
        {buttons.map(({ rating, label, keyHint, colors, keyColor }) => (
          <motion.button
            key={rating}
            whileTap={disabled ? {} : { scale: 0.95, y: 2 }}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              relative group flex flex-col items-center justify-center 
              min-h-[72px] sm:min-h-[84px] rounded-2xl border backdrop-blur-sm
              transition-all duration-300 ease-out
              ${colors}
              ${disabled ? 'opacity-40 grayscale-[20%] pointer-events-none' : ''}
            `}
          >
            <span className="text-sm sm:text-base font-bold">{label}</span>
            
            <kbd className={`
              hidden sm:flex absolute bottom-2 right-2 
              items-center justify-center w-5 h-5 
              text-[10px] font-bold rounded-md border
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
              ${keyColor}
            `}>
              {keyHint}
            </kbd>
          </motion.button>
        ))}
      </div>
    </div>
  )
}