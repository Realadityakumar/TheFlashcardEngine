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

const typeBadgeStyles: Record<FlashCardProps['type'], string> = {
  definition: 'bg-gray-100 text-gray-700',
  application: 'bg-green-100 text-green-700',
  relationship: 'bg-purple-100 text-purple-700',
  edge_case: 'bg-orange-100 text-orange-700',
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
      className="w-full max-w-2xl mx-auto"
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          transformStyle: 'preserve-3d',
          position: 'relative',
          minHeight: '380px',
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={onFlip}
        className="cursor-pointer"
      >
        {/* ── Front Face ── */}
        <div
          className="absolute inset-0 bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-xl font-medium text-gray-800 text-center leading-relaxed">
            {front}
          </p>
          <span className="absolute bottom-6 text-sm text-gray-400">
            Tap to reveal
          </span>
        </div>

        {/* ── Back Face ── */}
        <div
          className="absolute inset-0 bg-white rounded-2xl shadow-md p-8 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-lg text-gray-700 leading-relaxed">{back}</p>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2 mt-6">
            {/* Topic pill */}
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {topic}
            </span>

            {/* Type badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${typeBadgeStyles[type]}`}
            >
              {type.replace('_', ' ')}
            </span>

            {/* Source badge — only for visual or both */}
            {(source === 'visual' || source === 'both') && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                👁 from diagram
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
