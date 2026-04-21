'use client'

import { useEffect, useMemo, useState } from 'react'
import { gsap } from 'gsap'
import CalendarGrid, { FutureDay, PastDay, TodayStats } from '@/components/CalendarGrid'
import DayDetailPanel from '@/components/DayDetailPanel'
import StreakBar from '@/components/StreakBar'
import { calculateStreak } from '@/lib/streak'

interface CalendarData {
  futureDays: FutureDay[]
  pastDays: PastDay[]
  todayStats: TodayStats
}

interface DeckOption {
  id: string
  title: string
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function computeLongestStreak(dates: Date[]): number {
  if (dates.length === 0) return 0

  const uniqueDays = Array.from(
    new Set(
      dates.map((d) => {
        const day = new Date(d)
        day.setHours(0, 0, 0, 0)
        return day.getTime()
      })
    )
  ).sort((a, b) => a - b)

  let longest = 1
  let current = 1

  for (let i = 1; i < uniqueDays.length; i += 1) {
    if (uniqueDays[i] - uniqueDays[i - 1] === 86400000) {
      current += 1
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }

  return longest
}

export default function CalendarPage() {
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'due' | 'reviewed' | 'today' | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [deckFilter, setDeckFilter] = useState<string | null>(null)
  const [allDecks, setAllDecks] = useState<DeckOption[]>([])
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const tl = gsap.timeline()
    tl.fromTo('.calendar-header', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5 })
      .fromTo('.calendar-grid-wrapper', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.15 })
      .fromTo('.streak-bar', { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.3 })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setIsLoading(true)
    const deckId = deckFilter || ''

    fetch(`/api/calendar?month=${selectedMonth}&year=${selectedYear}&deckId=${deckId}`)
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || 'Failed to load calendar data')
        }
        return res.json() as Promise<CalendarData>
      })
      .then((data) => {
        setCalendarData(data)
      })
      .catch(() => {
        setCalendarData(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [selectedMonth, selectedYear, deckFilter])

  useEffect(() => {
    fetch('/api/decks')
      .then((res) => res.json())
      .then((data) => {
        setAllDecks(data.decks || [])
      })
      .catch(() => {
        setAllDecks([])
      })
  }, [])

  const isCurrentMonth =
    selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()

  const { dueThisMonth, dueThisWeek } = useMemo(() => {
    if (!calendarData) {
      return { dueThisMonth: 0, dueThisWeek: 0 }
    }

    const monthTotal = calendarData.todayStats.dueThisMonth ?? 0
    const weekTotal = calendarData.todayStats.dueThisWeek ?? 0

    return { dueThisMonth: monthTotal, dueThisWeek: weekTotal }
  }, [calendarData])

  const isEmptyMonth =
    !!calendarData &&
    calendarData.futureDays.length === 0 &&
    calendarData.pastDays.length === 0

  const streakDates = useMemo(() => {
    if (!calendarData) return []
    const days = calendarData.pastDays
      .filter((day) => day.reviewed > 0)
      .map((day) => parseDateKey(day.date))

    if (calendarData.todayStats.reviewedToday > 0) {
      days.push(parseDateKey(calendarData.todayStats.date))
    }

    return days
  }, [calendarData])

  const currentStreak = useMemo(() => calculateStreak(streakDates), [streakDates])
  const longestStreak = useMemo(() => computeLongestStreak(streakDates), [streakDates])

  const wrapperClass = `max-w-5xl mx-auto px-4 sm:px-6 py-8 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] rounded-2xl ${isPanelOpen && isDesktop ? 'mr-[380px] bg-[rgba(0,0,0,0.1)]' : 'bg-transparent'
    }`

  const handleSelectDate = (date: string, type: 'due' | 'reviewed' | 'today') => {
    setSelectedDate(date)
    setSelectedType(type)
    setIsPanelOpen(true)
  }

  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  const handleClosePanel = () => {
    setIsPanelOpen(false)
    // Keep selectedDate and selectedType so the grid retains the selection highlight
  }

  return (
    <div className={wrapperClass}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 calendar-header">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-[#f0f0ff]">
            Study Calendar
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">
            See when to review and track your history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={deckFilter || ''}
              onChange={(e) => setDeckFilter(e.target.value || null)}
              className="appearance-none bg-[#0f0f1a] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-[#f0f0ff] text-sm px-3 py-2 pr-8"
            >
              <option value="">All decks</option>
              {allDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#4a4a6a] text-xs">
              v
            </span>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(today.getMonth() + 1)
                setSelectedYear(today.getFullYear())
              }}
              className="rounded-xl border border-[rgba(108,99,255,0.2)] bg-[rgba(108,99,255,0.1)] px-4 py-2 text-sm text-[#6c63ff]"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="calendar-header flex flex-wrap gap-4 mt-5">
        <div className="bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] px-5 py-3 flex flex-col">
          <span className="font-mono text-2xl" style={{ color: '#6c63ff' }}>
            {dueThisMonth}
          </span>
          <span className="text-xs text-[#4a4a6a] uppercase tracking-wide">due this month</span>
        </div>
        <div className="bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] px-5 py-3 flex flex-col">
          <span className="font-mono text-2xl" style={{ color: '#ffb547' }}>
            {dueThisWeek}
          </span>
          <span className="text-xs text-[#4a4a6a] uppercase tracking-wide">due this week</span>
        </div>
      </div>

      <div className="calendar-grid-wrapper mt-8 relative">
        {isLoading && (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-[52px] sm:h-[72px] rounded-[10px] bg-[#161625] animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && calendarData && (
          <>
            <CalendarGrid
              month={selectedMonth}
              year={selectedYear}
              futureDays={calendarData.futureDays}
              pastDays={calendarData.pastDays}
              todayStats={calendarData.todayStats}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onMonthChange={handleMonthChange}
            />
            {isEmptyMonth && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-[#4a4a6a] text-center py-8">
                  No review data for this month
                </p>
              </div>
            )}
          </>
        )}

        {!isLoading && !calendarData && (
          <div className="text-sm text-[#4a4a6a]">Failed to load calendar data.</div>
        )}
      </div>

      {!isLoading && calendarData && (
        <div className="streak-bar mt-8">
          <StreakBar
            pastDays={calendarData.pastDays}
            todayReviewed={calendarData.todayStats.reviewedToday}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
          />
        </div>
      )}

      <DayDetailPanel
        isOpen={isPanelOpen}
        date={selectedDate}
        type={selectedType}
        onClose={handleClosePanel}
      />
    </div>
  )
}
