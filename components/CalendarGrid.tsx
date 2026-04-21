'use client'

import { useMemo, useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export interface FutureDay {
  date: string
  count: number
  deckBreakdown: { deckId: string; deckTitle: string; count: number }[]
}

export interface PastDay {
  date: string
  reviewed: number
  correct: number
}

export interface TodayStats {
  date: string
  dueCount: number
  reviewedToday: number
  dueThisWeek?: number
  dueThisMonth?: number
}

export interface CalendarGridProps {
  month: number
  year: number
  futureDays: FutureDay[]
  pastDays: PastDay[]
  todayStats: TodayStats
  selectedDate: string | null
  onSelectDate: (date: string, type: 'due' | 'reviewed' | 'today') => void
  onMonthChange: (month: number, year: number) => void
}

type Cell = { type: 'empty' } | { type: 'day'; dateKey: string; day: number }

type RangeLimit = {
  minIndex: number
  maxIndex: number
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthIndex(month: number, year: number): number {
  return year * 12 + (month - 1)
}

function addMonths(month: number, year: number, delta: number): { month: number; year: number } {
  const idx = monthIndex(month, year) + delta
  const nextYear = Math.floor(idx / 12)
  const nextMonth = (idx % 12) + 1
  return { month: nextMonth, year: nextYear }
}

function buildRangeLimits(): RangeLimit {
  const today = new Date()
  const currentIndex = monthIndex(today.getMonth() + 1, today.getFullYear())
  return {
    minIndex: currentIndex - 3,
    maxIndex: currentIndex + 6,
  }
}

function getMonthLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function getRetentionColor(correct: number, reviewed: number): string {
  if (reviewed === 0) return '#4a4a6a'
  const ratio = correct / reviewed
  if (ratio >= 0.8) return '#00e5a0'
  if (ratio >= 0.5) return '#ffb547'
  return '#ff4d6d'
}

function getBadgeStyles(count: number): { bg: string; color: string; label: string } {
  const label = count > 9 ? '9+' : String(count)
  if (count <= 5) return { bg: 'rgba(108,99,255,0.2)', color: '#6c63ff', label }
  if (count <= 15) return { bg: 'rgba(255,181,71,0.2)', color: '#ffb547', label }
  return { bg: 'rgba(255,77,109,0.2)', color: '#ff4d6d', label }
}

export default function CalendarGrid({
  month,
  year,
  futureDays,
  pastDays,
  todayStats,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: CalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Badge entrance animation whenever data updates
  useEffect(() => {
    gsap.fromTo(
      '.day-badge',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, stagger: 0.02, ease: 'back.out(1.7)' }
    )
  }, [futureDays, pastDays, todayStats])

  // Month arrival animation (incoming)
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.25, clearProps: 'transform' }
      )
    }
  }, [month, year])
  const { minIndex, maxIndex } = useMemo(buildRangeLimits, [])
  const currentIndex = monthIndex(month, year)
  const canPrev = currentIndex > minIndex
  const canNext = currentIndex < maxIndex

  const futureMap = useMemo(() => {
    const map = new Map<string, FutureDay>()
    futureDays.forEach((day) => map.set(day.date, day))
    return map
  }, [futureDays])

  const pastMap = useMemo(() => {
    const map = new Map<string, PastDay>()
    pastDays.forEach((day) => map.set(day.date, day))
    return map
  }, [pastDays])

  const cells: Cell[] = useMemo(() => {
    const firstDayIndex = new Date(year, month - 1, 1).getDay()
    const totalDays = new Date(year, month, 0).getDate()

    const baseCells: Cell[] = []
    for (let i = 0; i < firstDayIndex; i += 1) {
      baseCells.push({ type: 'empty' })
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = formatDateLocal(new Date(year, month - 1, day))
      baseCells.push({ type: 'day', dateKey, day })
    }

    const remainder = baseCells.length % 7
    const padding = remainder === 0 ? 0 : 7 - remainder
    for (let i = 0; i < padding; i += 1) {
      baseCells.push({ type: 'empty' })
    }

    return baseCells
  }, [month, year])

  const todayKey = todayStats?.date || formatDateLocal(new Date())

  const handlePrev = () => {
    if (!canPrev) return
    gsap.fromTo(
      containerRef.current,
      { opacity: 1, x: 0 },
      {
        opacity: 0,
        x: -20,
        duration: 0.15,
        onComplete: () => {
          const next = addMonths(month, year, -1)
          onMonthChange(next.month, next.year)
        },
      }
    )
  }

  const handleNext = () => {
    if (!canNext) return
    gsap.fromTo(
      containerRef.current,
      { opacity: 1, x: 0 },
      {
        opacity: 0,
        x: -20, // Wait, animation spec says opacity 1 -> 0, x 0 -> -20.
        // I guess moving left for both out-going makes it feel like it slides left and drops out?
        // Let's stick with that logic or use context.
        duration: 0.15,
        onComplete: () => {
          const next = addMonths(month, year, 1)
          onMonthChange(next.month, next.year)
        },
      }
    )
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canPrev}
          className={`text-sm px-2 py-1 rounded-md transition-colors ${canPrev ? 'text-[#8888aa] hover:text-[#f0f0ff]' : 'text-[#2d2d40] cursor-not-allowed'}`}
        >
          ←
        </button>
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#f0f0ff]">
          {getMonthLabel(month, year)}
        </h3>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext}
          className={`text-sm px-2 py-1 rounded-md transition-colors ${canNext ? 'text-[#8888aa] hover:text-[#f0f0ff]' : 'text-[#2d2d40] cursor-not-allowed'}`}
        >
          →
        </button>
      </div>

      <div ref={containerRef} className="calendar-grid-wrapper">
        <div className="grid grid-cols-7 gap-[3px] sm:gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div
            key={label}
            className="text-xs text-[#4a4a6a] uppercase tracking-widest text-center"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[3px] sm:gap-1">
        {cells.map((cell, index) => {
          if (cell.type === 'empty') {
            return <div key={`empty-${index}`} className="w-[44px] h-[44px] sm:w-[72px] sm:h-[72px]" />
          }

          const dateKey = cell.dateKey
          const isSelected = selectedDate === dateKey
          const isToday = dateKey === todayKey
          const isPast = dateKey < todayKey

          const pastEntry = pastMap.get(dateKey)
          const futureEntry = futureMap.get(dateKey)

          let isClickable = false
          let clickType: 'due' | 'reviewed' | 'today' | null = null
          let baseClasses = 'relative w-[44px] h-[44px] sm:w-[72px] sm:h-[72px] rounded-md sm:rounded-[10px] border flex flex-col items-center justify-start pt-1 sm:pt-2 transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]'
          let dateColor = '#4a4a6a'
          let bgClass = 'bg-[#0f0f1a]'
          let borderClass = 'border-[rgba(255,255,255,0.03)]'
          let hoverClass = ''
          let opacityClass = 'opacity-100'

          if (isToday) {
            isClickable = true
            clickType = 'today'
            bgClass = isSelected ? 'bg-[rgba(108,99,255,0.08)]' : 'bg-[rgba(108,99,255,0.1)]'
            borderClass = isSelected ? 'border-[rgba(108,99,255,0.4)]' : 'border-[rgba(108,99,255,0.4)]'
            hoverClass = 'hover:bg-[rgba(108,99,255,0.15)]'
            dateColor = '#6c63ff'
          } else if (isPast) {
            if (pastEntry && pastEntry.reviewed > 0) {
              isClickable = true
              clickType = 'reviewed'
              borderClass = isSelected ? 'border-[rgba(108,99,255,0.4)]' : 'border-[rgba(255,255,255,0.06)]'
              bgClass = isSelected ? 'bg-[rgba(108,99,255,0.08)]' : 'bg-[#0f0f1a]'
              hoverClass = 'hover:bg-[#161625]'
              dateColor = '#8888aa'
            } else {
              dateColor = '#4a4a6a'
              bgClass = 'bg-[#0f0f1a]'
              borderClass = 'border-[rgba(255,255,255,0.03)]'
              opacityClass = 'opacity-40' // Empty past day = lower emphasis
            }
          } else {
            if (futureEntry && futureEntry.count > 0) {
              isClickable = true
              clickType = 'due'
              borderClass = isSelected ? 'border-[rgba(108,99,255,0.4)]' : 'border-[rgba(255,255,255,0.06)]'
              bgClass = isSelected ? 'bg-[rgba(108,99,255,0.08)]' : 'bg-[#0f0f1a]'
              hoverClass = 'hover:bg-[#161625] hover:border-[rgba(255,255,255,0.1)]'
              dateColor = '#f0f0ff'
            } else {
              dateColor = '#4a4a6a'
              bgClass = 'bg-[#0f0f1a]'
              borderClass = 'border-[rgba(255,255,255,0.03)]'
              opacityClass = 'opacity-40' // Empty future day
            }
          }

          // Force selected style if it is selected (to override normal empty logic in edge cases if any)
          if (isSelected) {
             opacityClass = 'opacity-100'
          }

          const showBadge = (isToday && todayStats?.dueCount > 0) || (!isToday && !isPast && futureEntry && futureEntry.count > 0)
          const badgeCount = isToday ? todayStats?.dueCount || 0 : futureEntry?.count || 0
          const badgeStyles = showBadge ? getBadgeStyles(badgeCount) : null

          const showRetention = isPast && pastEntry && pastEntry.reviewed > 0
          const retentionColor = showRetention ? getRetentionColor(pastEntry.correct, pastEntry.reviewed) : null

          // if today has due, add animation class
          const hasDueToday = isToday && todayStats?.dueCount > 0
          const todayPulseClass = hasDueToday ? 'animate-today-pulse' : ''

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => {
                if (isClickable && clickType) onSelectDate(dateKey, clickType)
              }}
              className={`${baseClasses} ${bgClass} ${borderClass} ${hoverClass} ${opacityClass} ${todayPulseClass} ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="text-xs sm:text-sm" style={{ color: dateColor, fontWeight: isToday ? 700 : 500 }}>
                {cell.day}
              </span>

              {showRetention && retentionColor && (
                <span
                  className="mt-1 sm:mt-2"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 9999,
                    background: retentionColor,
                  }}
                />
              )}

              {showBadge && badgeStyles && (
                <span
                  className="day-badge absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-[13px] h-[13px] sm:w-[18px] sm:h-[18px] flex items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[8px] sm:text-[10px] font-semibold"
                  style={{ background: badgeStyles.bg, color: badgeStyles.color }}
                >
                  {badgeStyles.label}
                </span>
              )}
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
