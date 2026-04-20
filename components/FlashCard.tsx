'use client'

import { motion } from 'framer-motion'

interface FlashCardProps {
  front: string
  back: string
  topic: string
  type: 'definition' | 'application' | 'relationship' | 'edge_case'
  source: 'text' | 'visual' | 'both'
  isFlipped: boolean
  onFlip: () => void
}

const typeStyles: Record<FlashCardProps['type'], { bg: string; color: string }> = {
  definition: { bg: 'rgba(255,255,255,0.06)', color: '#8888aa' },
  application: { bg: 'rgba(0,229,160,0.08)', color: '#00e5a0' },
  relationship: { bg: 'rgba(0,210,255,0.08)', color: '#00d2ff' },
  edge_case: { bg: 'rgba(255,181,71,0.08)', color: '#ffb547' }
}

export default function FlashCard({
  front,
  back,
  topic,
  type,
  source,
  isFlipped,
  onFlip,
}: FlashCardProps) {
  return (
    <div
      style={{ perspective: '1200px' }}
      className="w-full max-w-xl mx-auto"
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-hint { 
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        .animate-bounce-hint {
          animation: bounce-hint 2s ease-in-out infinite;
        }
      `}} />

      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          transformStyle: 'preserve-3d',
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={onFlip}
        className="cursor-pointer relative w-full min-h-[280px] md:min-h-[380px]"
      >
        {/* ── Front Face ── */}
        <div
          className={`absolute inset-0 bg-[#0f0f1a] rounded-[20px] px-[36px] py-[40px] overflow-hidden flex flex-col items-center justify-center transition-all duration-200 ${!isFlipped ? 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]' : ''}`}
          style={{ 
            backfaceVisibility: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {/* Background decorations */}
          <div 
            className="absolute top-0 left-0 w-[200px] h-[200px] pointer-events-none"
            style={{ background: 'radial-gradient(circle at top left, rgba(108,99,255,0.06)_0%, transparent_70%)' }}
          />
          <div 
            className="absolute bottom-0 right-0 w-[150px] h-[150px] pointer-events-none"
            style={{ background: 'radial-gradient(circle at bottom right, rgba(0,210,255,0.04)_0%, transparent_70%)' }}
          />

          <span className="text-xs text-[#4a4a6a] uppercase tracking-widest absolute top-[40px]">
            Question
          </span>

          <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#f0f0ff] mt-4 leading-relaxed text-center z-10 w-full">
            {front}
          </p>

          <div className="absolute bottom-[20px] left-0 right-0 text-center flex flex-col items-center justify-center">
            <span className="text-xs text-[#4a4a6a]">Tap to reveal</span>
            <svg 
              className="w-4 h-4 text-[#4a4a6a] mt-1 animate-bounce-hint" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* ── Back Face ── */}
        <div
          className="absolute inset-0 bg-[#0f0f1a] rounded-[20px] px-[36px] py-[40px] flex flex-col"
          style={{ 
            backfaceVisibility: 'hidden', 
            transform: 'rotateY(180deg)',
            border: '1px solid rgba(108,99,255,0.15)'
          }}
        >
          <span className="text-xs text-[#6c63ff] uppercase tracking-widest block">
            Answer
          </span>

          <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar pr-2 -mr-2">
            <style dangerouslySetInnerHTML={{__html: `
              .custom-scrollbar::-webkit-scrollbar {
                width: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #1e1e30;
                border-radius: 4px;
              }
            `}} />
            <p className="font-[family-name:var(--font-body)] text-lg text-[#e0e0f0] leading-relaxed">
              {back}
            </p>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/[0.04]">
            {/* Topic pill */}
            <span 
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', color: '#6c63ff' }}
            >
              {topic}
            </span>

            {/* Type badge */}
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: typeStyles[type].bg, color: typeStyles[type].color }}
            >
              {type.replace('_', ' ')}
            </span>

            {/* Source badge — only for visual or both */}
            {(source === 'visual' || source === 'both') && (
              <span 
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.15)', color: '#ffb547' }}
              >
                👁 visual
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
