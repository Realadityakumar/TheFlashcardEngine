'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

interface DayDetailPanelProps {
  isOpen: boolean
  date: string | null
  type: 'due' | 'reviewed' | 'today' | null
  onClose: () => void
}

type DeckSummary = { deckId: string; deckTitle: string; count: number }

type MasteryState = 'mastered' | 'learning' | 'new'

type DueCard = {
  id: string
  front: string
  back: string
  topic: string
  type: string
  source: string
  easeFactor: number
  interval: number
  repetitions: number
  dueDate: string
  deck: { id: string; title: string }
  masteryState: MasteryState
}

type ReviewedCard = {
  id: string
  front: string
  topic: string
  deck: { id: string; title: string }
  rating: number
}

type CalendarCardsResponse = {
  cards: DueCard[] | ReviewedCard[]
  date: string
  totalCount: number
  type: 'due' | 'reviewed'
  deckSummary: DeckSummary[]
  todayStats?: { dueCount: number; reviewedToday: number }
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatHeaderDate(dateStr: string): string {
  const date = parseDateString(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMasteryDot(state: MasteryState): string {
  if (state === 'mastered') return '#00e5a0'
  if (state === 'learning') return '#ffb547'
  return '#4a4a6a'
}

function getRatingStyle(rating: number): { label: string; color: string; bg: string } {
  if (rating === 0) return { label: 'Again', color: '#ff4d6d', bg: 'rgba(255,77,109,0.12)' }
  if (rating === 1) return { label: 'Hard', color: '#ffb547', bg: 'rgba(255,181,71,0.12)' }
  if (rating === 2) return { label: 'Good', color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' }
  return { label: 'Easy', color: '#00e5a0', bg: 'rgba(0,229,160,0.12)' }
}

export default function DayDetailPanel({
  isOpen,
  date,
  type,
  onClose,
}: DayDetailPanelProps) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)

  const [data, setData] = useState<CalendarCardsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showDeckPicker, setShowDeckPicker] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isOpen || !date || !type) {
      setData(null)
      setLoading(false)
      setError(null)
      setShowDeckPicker(false)
      return
    }

    const fetchType = type === 'today' ? 'due' : type

    setLoading(true)
    setError(null)

    fetch(`/api/calendar/cards?date=${date}&type=${fetchType}`)
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || 'Failed to load details')
        }
        return res.json() as Promise<CalendarCardsResponse>
      })
      .then((payload) => {
        setData(payload)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load details')
        setData(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen, date, type])

  const headerDate = date ? formatHeaderDate(date) : 'Select a date'

  const todayKey = formatDateLocal(new Date())
  const selectedDate = date ? parseDateString(date) : null
  const todayDate = parseDateString(todayKey)
  const selectedMs = selectedDate ? selectedDate.getTime() : 0
  const todayMs = todayDate.getTime()
  const isDateTodayOrPast = selectedDate ? selectedMs <= todayMs : false
  const isFutureDate = selectedDate ? selectedMs > todayMs : false
  const daysUntil = isFutureDate
    ? Math.max(1, Math.ceil((selectedMs - todayMs) / 86400000))
    : 0

  const deckSummary = data?.deckSummary || []
  const hasDecks = deckSummary.length > 0
  const multipleDecks = deckSummary.length > 1

  const showStudyAction = (type === 'due' || type === 'today') && hasDecks
  const todayStats = data?.todayStats
  const showTodayCaughtUp = type === 'today' && todayStats && todayStats.dueCount === 0
  const dueCountLabel = type === 'today'
    ? todayStats?.dueCount ?? 0
    : data?.type === 'due'
      ? data.totalCount
      : 0

  const handleStudyClick = () => {
    if (!hasDecks) return
    if (multipleDecks) {
      setShowDeckPicker(true)
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const deckId = deckSummary[0]?.deckId
    if (deckId) router.push(`/decks/${deckId}/study`)
  }

  const handleDeckClick = (deckId: string) => {
    if (!deckId) return
    if ((type === 'due' || type === 'today') && isDateTodayOrPast) {
      router.push(`/decks/${deckId}/study`)
      return
    }
    router.push(`/decks/${deckId}`)
  }

  const dueCardsByDeck = useMemo(() => {
    if (!data || data.type !== 'due') return []
    const cards = (data.cards as DueCard[]).filter(
      (card) => card.deck && card.deck.id && card.deck.title
    )
    const map = new Map<string, { deck: { id: string; title: string }; cards: DueCard[] }>()
    cards.forEach((card) => {
      const key = card.deck.id
      const entry = map.get(key)
      if (entry) {
        entry.cards.push(card)
      } else {
        map.set(key, { deck: card.deck, cards: [card] })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.deck.title.localeCompare(b.deck.title))
  }, [data])

  const reviewedSummary = useMemo(() => {
    if (!data || data.type !== 'reviewed') return null
    const cards = (data.cards as ReviewedCard[]).filter(
      (card) => card.deck && card.deck.id && card.deck.title
    )
    const summary = { again: 0, hard: 0, good: 0, easy: 0 }
    cards.forEach((card) => {
      if (card.rating === 0) summary.again += 1
      else if (card.rating === 1) summary.hard += 1
      else if (card.rating === 2) summary.good += 1
      else summary.easy += 1
    })
    const total = cards.length
    const correct = summary.good + summary.easy
    const retention = total > 0 ? Math.round((correct / total) * 100) : 0
    const retentionColor = retention >= 70 ? '#00e5a0' : retention >= 50 ? '#ffb547' : '#ff4d6d'

    return { ...summary, total, retention, retentionColor }
  }, [data])

  const panelMotion = isMobile
    ? {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    }
    : {
      initial: { x: 380, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 380, opacity: 0 },
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    }

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(8,8,15,0.6)', backdropFilter: 'blur(4px)' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            {...panelMotion}
            className={
              isMobile
                ? 'fixed bottom-0 left-0 right-0 z-40 max-h-[90vh] overflow-y-auto rounded-t-[20px] bg-[#0f0f1a] px-5 py-6'
                : 'fixed right-0 top-[60px] bottom-0 z-40 w-[380px] overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[#0f0f1a] px-5 py-6'
            }
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
                  .shimmer { background: linear-gradient(90deg, #0f0f1a 25%, #161625 50%, #0f0f1a 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
                  .panel-scroll { scrollbar-width: thin; scrollbar-color: #1e1e30 #0f0f1a; }
                  .panel-scroll::-webkit-scrollbar { width: 6px; }
                  .panel-scroll::-webkit-scrollbar-track { background: #0f0f1a; }
                  .panel-scroll::-webkit-scrollbar-thumb { background: #1e1e30; border-radius: 999px; }
                  .panel-scroll::-webkit-scrollbar-thumb:hover { background: #2a2a40; }
                `,
              }}
            />
            <div className="relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-md text-[#4a4a6a] transition-colors hover:bg-[#161625] hover:text-[#f0f0ff]"
              >
                ×
              </button>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#f0f0ff] pr-10">
                {headerDate}
              </h2>
              <p className="mt-1 text-sm text-[#8888aa]">
                {type === 'due' && 'Cards due for review'}
                {type === 'today' && (
                  <>
                    Due today · <span style={{ color: '#6c63ff' }}>{dueCountLabel} cards</span>
                  </>
                )}
                {type === 'reviewed' && 'Review history'}
              </p>

              {showStudyAction && !isFutureDate && (
                <button
                  type="button"
                  onClick={handleStudyClick}
                  className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6c63ff, #00d2ff)',
                    boxShadow: '0 4px 15px rgba(108,99,255,0.25)',
                  }}
                >
                  {multipleDecks ? 'Choose a deck to study' : 'Study now'}
                </button>
              )}
              {showStudyAction && isFutureDate && (
                <div className="mt-4 w-full rounded-xl border border-[rgba(255,255,255,0.08)] py-2.5 text-center text-sm text-[#4a4a6a]">
                  Available in {daysUntil} days
                </div>
              )}
            </div>

            {hasDecks && (
              <div className="mt-3 flex flex-wrap gap-2">
                {deckSummary.map((deck) => (
                  <button
                    key={deck.deckId}
                    type="button"
                    onClick={() => handleDeckClick(deck.deckId)}
                    className={`rounded-full border px-3 py-1 text-xs transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ${showDeckPicker
                        ? 'border-[rgba(108,99,255,0.3)] bg-[rgba(108,99,255,0.1)] text-[#d8d6ff] hover:border-[rgba(108,99,255,0.45)]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#8888aa] hover:border-[rgba(255,255,255,0.12)] hover:text-[#f0f0ff]'
                      }`}
                  >
                    {deck.deckTitle}: {deck.count}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 mb-4 h-px w-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

            {error && (
              <div className="rounded-lg border border-[rgba(255,77,109,0.25)] bg-[rgba(255,77,109,0.08)] px-3 py-2 text-xs text-[#ff9db0]">
                {error}
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                <div className="h-14 rounded-lg shimmer" />
                <div className="h-14 rounded-lg shimmer" />
                <div className="h-14 rounded-lg shimmer" />
              </div>
            )}

            {!loading && !error && showTodayCaughtUp && (
              <div className="py-8 text-center">
                <p className="text-sm text-[#00e5a0]">You're all caught up today! 🎉</p>
                {todayStats && todayStats.reviewedToday > 0 && (
                  <p className="text-xs text-[#4a4a6a] mt-1">
                    You reviewed {todayStats.reviewedToday} cards today
                  </p>
                )}
              </div>
            )}

            {!loading && !error && data && data.totalCount === 0 && !showTodayCaughtUp && (
              <div className="py-10 text-center">
                <p className="text-sm text-[#4a4a6a]">Nothing here</p>
                <p className="text-xs text-[#4a4a6a] mt-1">
                  {type === 'reviewed'
                    ? 'No reviews recorded on this day'
                    : 'No cards scheduled for this day'}
                </p>
              </div>
            )}

            {!loading && !error && data && data.totalCount > 0 && (
              <div ref={listRef}>
                {data.type === 'reviewed' && reviewedSummary && (
                  <div className="mb-4 rounded-[10px] bg-[#161625] px-3 py-2">
                    <div className="text-xs text-[#8888aa]">
                      <span style={{ color: '#ff4d6d' }}>Again {reviewedSummary.again}</span>
                      <span className="mx-1">·</span>
                      <span style={{ color: '#ffb547' }}>Hard {reviewedSummary.hard}</span>
                      <span className="mx-1">·</span>
                      <span style={{ color: '#6c63ff' }}>Good {reviewedSummary.good}</span>
                      <span className="mx-1">·</span>
                      <span style={{ color: '#00e5a0' }}>Easy {reviewedSummary.easy}</span>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: reviewedSummary.retentionColor }}>
                      Session retention: {reviewedSummary.retention}%
                    </div>
                  </div>
                )}

                {data.type === 'due' && (
                  <div className="panel-scroll max-h-[50vh] overflow-y-auto pr-1 space-y-2">
                    {dueCardsByDeck.map((group) => (
                      <div key={group.deck.id}>
                        <button
                          type="button"
                          onClick={() => handleDeckClick(group.deck.id)}
                          className="py-2 text-xs font-medium tracking-wide uppercase text-[#6c63ff] transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[#8b85ff]"
                        >
                          {group.deck.title}
                        </button>
                        {group.cards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => router.push(`/decks/${card.deck.id}/study`)}
                            className="flex w-full items-start gap-3 border-b border-[rgba(255,255,255,0.04)] py-3 text-left transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[rgba(255,255,255,0.03)]"
                          >
                            <span
                              className="mt-1"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 9999,
                                background: getMasteryDot(card.masteryState),
                                flexShrink: 0,
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm text-[#e0e0f0] line-clamp-2">{card.front}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-[#4a4a6a]">{card.deck.title}</div>
                              {(() => {
                                const dueDate = new Date(card.dueDate)
                                dueDate.setHours(0, 0, 0, 0)
                                const isOverdue = dueDate < todayDate
                                return isOverdue ? (
                                  <span className="mt-1 inline-flex items-center rounded-full border border-[rgba(255,77,109,0.2)] bg-[rgba(255,77,109,0.1)] px-2 py-0.5 text-[10px] text-[#ff4d6d]">
                                    OVERDUE
                                  </span>
                                ) : null
                              })()}
                              <span className="mt-1 inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] text-[#8888aa]">
                                {card.topic}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {data.type === 'reviewed' && (
                  <div className="panel-scroll max-h-[50vh] overflow-y-auto pr-1 space-y-2">
                    {(data.cards as ReviewedCard[])
                      .filter((card) => card.deck && card.deck.id && card.deck.title)
                      .map((card) => {
                        const ratingStyle = getRatingStyle(card.rating)
                        return (
                          <button
                            key={`${card.id}-${card.rating}`}
                            type="button"
                            onClick={() => router.push(`/decks/${card.deck.id}`)}
                            className="flex w-full items-center gap-3 border-b border-[rgba(255,255,255,0.04)] py-3 text-left transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[rgba(255,255,255,0.03)]"
                          >
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px]"
                              style={{ background: ratingStyle.bg, color: ratingStyle.color }}
                            >
                              {ratingStyle.label}
                            </span>
                            <span className="flex-1 text-sm text-[#e0e0f0] line-clamp-1">{card.front}</span>
                            <span className="text-xs text-[#4a4a6a]">{card.deck.title}</span>
                          </button>
                        )
                      })}
                  </div>
                )}

                {data.totalCount >= 10 && (
                  <div className="pt-2 text-center text-xs text-[#4a4a6a]">
                    Showing all {data.totalCount} cards
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
