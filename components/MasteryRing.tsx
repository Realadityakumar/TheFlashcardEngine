'use client'

import { motion } from 'framer-motion'

interface MasteryRingProps {
  mastered: number
  shaky: number
  newCards: number
  total: number
  size?: number // default 120
}

export default function MasteryRing({
  mastered,
  shaky,
  newCards,
  total,
  size = 120,
}: MasteryRingProps) {
  const radius = size / 2 - 10
  const circumference = 2 * Math.PI * radius
  const strokeWidth = 8
  const center = size / 2

  const masteryPercent = total > 0 ? Math.round((mastered / total) * 100) : 0

  const mLen = total > 0 ? (mastered / total) * circumference : 0
  const sLen = total > 0 ? (shaky / total) * circumference : 0
  const nLen = total > 0 ? (newCards / total) * circumference : 0

  const mOffset = 0
  const sOffset = -mLen
  const nOffset = -(mLen + sLen)

  return (
    <div className="flex flex-col items-center">
      {/* SVG Ring container */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          {/* Background circle (light gray) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Arc 1 (green, mastered) */}
          {total > 0 && (
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#22c55e"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDashoffset={mOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${mLen} ${circumference}` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          )}

          {/* Arc 2 (yellow, shaky) */}
          {total > 0 && (
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#facc15"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDashoffset={sOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${sLen} ${circumference}` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          )}

          {/* Arc 3 (gray, new) */}
          {total > 0 && (
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#d1d5db"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDashoffset={nOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${nLen} ${circumference}` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          )}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">
            {masteryPercent}%
          </span>
          <span className="text-xs text-gray-500">mastered</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-col gap-2 text-sm text-gray-600 w-full px-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span>Mastered: {mastered}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          <span>Shaky: {shaky}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
          <span>New: {newCards}</span>
        </div>
      </div>
    </div>
  )
}
