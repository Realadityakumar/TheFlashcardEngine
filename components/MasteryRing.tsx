'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'

interface MasteryRingProps {
  mastered?: number
  shaky?: number
  newCards?: number
  dueToday?: number
  reviewedToday?: number
  total: number
  mode?: 'mastery' | 'due'
  size?: number // default 72
}

export default function MasteryRing({
  mastered = 0,
  shaky = 0,
  newCards = 0,
  dueToday = 0,
  reviewedToday = 0,
  total,
  mode = 'mastery',
  size = 72,
}: MasteryRingProps) {
  const countRef = useRef<HTMLSpanElement>(null)

  const radius = size / 2 - 6
  const circumference = 2 * Math.PI * radius
  const strokeWidth = 5
  const center = size / 2

  const totalDueToday = dueToday + reviewedToday
  const primaryPercent = mode === 'due'
    ? (totalDueToday > 0 ? Math.round((reviewedToday / totalDueToday) * 100) : 100)
    : (total > 0 ? Math.round((mastered / total) * 100) : 0)

  const mLen = total > 0 ? (mastered / total) * circumference : 0
  const sLen = total > 0 ? (shaky / total) * circumference : 0
  const nLen = total > 0 ? (newCards / total) * circumference : 0
  const dueLen = mode === 'due' ? (primaryPercent / 100) * circumference : 0

  const mOffset = 0
  const sOffset = -mLen
  const nOffset = -(mLen + sLen)
  const dueOffset = 0

  useEffect(() => {
    if (!countRef.current) return
    gsap.fromTo(countRef.current,
      { innerText: 0 },
      {
        innerText: primaryPercent,
        duration: 1.2,
        ease: 'power2.out',
        snap: { innerText: 1 },
        onUpdate: function() {
          if (countRef.current) {
            countRef.current.textContent = Math.round(Number(this.targets()[0].innerText)) + '%'
          }
        }
      }
    )
  }, [primaryPercent])

  return (
    <div className="flex flex-col items-end">
      {/* SVG Ring container */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          {/* Background circle (track) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#161625"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Mastery Mode Arcs */}
          {mode === 'mastery' && total > 0 && (
            <>
              <motion.circle cx={center} cy={center} r={radius} stroke="#00e5a0" strokeWidth={strokeWidth} fill="transparent" strokeDashoffset={mOffset} initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${mLen} ${circumference}` }} transition={{ duration: 1, ease: 'easeOut' }} />
              <motion.circle cx={center} cy={center} r={radius} stroke="#ffb547" strokeWidth={strokeWidth} fill="transparent" strokeDashoffset={sOffset} initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${sLen} ${circumference}` }} transition={{ duration: 1, ease: 'easeOut' }} />
              <motion.circle cx={center} cy={center} r={radius} stroke="#1e1e30" strokeWidth={strokeWidth} fill="transparent" strokeDashoffset={nOffset} initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${nLen} ${circumference}` }} transition={{ duration: 1, ease: 'easeOut' }} />
            </>
          )}

          {/* Due Mode Arcs */}
          {mode === 'due' && total > 0 && (
            <motion.circle cx={center} cy={center} r={radius} stroke="#ffb547" strokeWidth={strokeWidth} fill="transparent" strokeDashoffset={dueOffset} initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${dueLen} ${circumference}` }} transition={{ duration: 1, ease: 'easeOut' }} />
          )}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center -mt-1">
          <span 
            ref={countRef}
            className="text-xl font-bold font-[family-name:var(--font-mono)] text-[#f0f0ff] leading-none"
          >
            {primaryPercent}%
          </span>
          {mode === 'mastery' && (
            <span className="text-[10px] text-[#4a4a6a] mt-0.5">mastered</span>
          )}
        </div>
      </div>

      {/* Legend below */}
      <div className="mt-3 flex flex-col gap-1.5 w-full pr-1">
        {mode === 'mastery' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-[6px] h-[6px] rounded-full bg-[#00e5a0] inline-block shrink-0" />
              <span className="text-xs text-[#8888aa]">
                Mastered <span className="font-[family-name:var(--font-mono)] ml-1">{mastered}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[6px] h-[6px] rounded-full bg-[#ffb547] inline-block shrink-0" />
              <span className="text-xs text-[#8888aa]">
                Learning <span className="font-[family-name:var(--font-mono)] ml-1">{shaky}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[6px] h-[6px] rounded-full bg-[#1e1e30] inline-block shrink-0" />
              <span className="text-xs text-[#8888aa]">
                New <span className="font-[family-name:var(--font-mono)] ml-1">{newCards}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center -mt-1 pt-1 opacity-80">
              <span className="text-xs text-[#ffb547]">
                Due <span className="font-[family-name:var(--font-mono)] ml-1 font-semibold">{dueToday}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
