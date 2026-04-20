
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import FlashCard from '@/components/FlashCard'
import RatingButtons from '@/components/RatingButtons'
import { PageTransition } from '@/components/PageTransition'
import { UpcomingSchedule } from '@/components/UpcomingSchedule'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Card {
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
}

interface ScheduleEntry {
  date: string
  count: number
  isToday: boolean
  label: string
}

type SessionState = 'loading' | 'empty' | 'studying' | 'complete'

// ─── Session stats ────────────────────────────────────────────────────────────

interface SessionStats {
  again: number
  hard: number
  good: number
  easy: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudyPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string

  // Queue-based session state
  // sessionQueue: cards still to review (Again cards are re-appended here)
  // completedIds: Set of card IDs that have been rated Hard/Good/Easy (done for this session)
  // originalTotal: how many cards were fetched at session start (for progress bar)
  const [sessionQueue, setSessionQueue] = useState<Card[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [originalTotal, setOriginalTotal] = useState(0)

  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [pageState, setPageState] = useState<SessionState>('loading')

  // Schedule data shown on completion screen
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // ── Fetch due cards on mount ────────────────────────────────────────────────

  const fetchDueCards = useCallback(async () => {
    setPageState('loading')
    setIsFlipped(false)
    setCompletedIds(new Set())
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 })

    try {
      const res = await fetch(`/api/study?deckId=${deckId}&limit=20`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      if (data.cards.length === 0) {
        setPageState('empty')
        fetchSchedule() // show when next review is even on empty state
      } else {
        setSessionQueue(data.cards)
        setOriginalTotal(data.cards.length)
        setPageState('studying')
      }
    } catch (err) {
      console.error('[study] fetch error:', err)
      setPageState('empty')
    }
  }, [deckId])

  // ── Fetch review schedule (called on session complete and empty state) ──────

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true)
    try {
      const res = await fetch(`/api/schedule?deckId=${deckId}`)
      const data = await res.json()
      if (res.ok) {
        setSchedule(data.schedule)
        setNextReviewAt(data.nextReviewAt)
      }
    } catch (err) {
      console.error('[study] schedule fetch error:', err)
    } finally {
      setLoadingSchedule(false)
    }
  }, [deckId])

  useEffect(() => {
    fetchDueCards()
  }, [fetchDueCards])

  // ── Space bar flips the card ────────────────────────────────────────────────

  useEffect(() => {
    if (pageState !== 'studying') return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFlipped) {
        e.preventDefault()
        setIsFlipped(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pageState, isFlipped])

  // ── Core rating handler ─────────────────────────────────────────────────────

  async function handleRate(rating: 0 | 1 | 2 | 3) {
    if (isSubmitting || sessionQueue.length === 0) return
    setIsSubmitting(true)

    const currentCard = sessionQueue[0]

    try {
      // Always POST to /api/review — this saves SM-2 result to DB
      // Again → re-queue card to end of session (you must get it right before finishing)
      // Hard/Good/Easy → card is done for this session (SM-2 schedules future review)
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCard.id, rating }),
      })

      if (!res.ok) throw new Error('Review save failed')

      const data = await res.json()

      // Update sessionStats
      const statKey = ['again', 'hard', 'good', 'easy'][rating] as keyof SessionStats
      setSessionStats(prev => ({ ...prev, [statKey]: prev[statKey] + 1 }))

      if (rating === 0) {
        // ── Again (0) ─────────────────────────────────────────────────────────
        // Re-queue: move current card to end of session queue
        // Update the card's SM-2 values locally so the preview intervals
        // on RatingButtons reflect the new state if the card appears again
        const updatedCard: Card = {
          ...currentCard,
          easeFactor: data.card.easeFactor,
          interval: data.card.interval,
          repetitions: data.card.repetitions,
        }
        setSessionQueue(q => [...q.slice(1), updatedCard])
      } else {
        // ── Hard (1), Good (2), or Easy (3) ───────────────────────────────────
        // Card is done for this session. SM-2 already scheduled the future review:
        //   Hard → shorter interval (e.g., 3 days)
        //   Good → normal interval (e.g., 6 days)
        //   Easy → boosted interval (e.g., 10 days)
        setCompletedIds(prev => new Set([...prev, currentCard.id]))
        const newQueue = sessionQueue.slice(1)
        setSessionQueue(newQueue)

        // If queue is now empty, session is complete
        if (newQueue.length === 0) {
          fireConfetti()
          await fetchSchedule()
          setPageState('complete')
          return
        }
      }

      // Advance to next card (flip back to front)
      setIsFlipped(false)

    } catch (err) {
      console.error('[study] rate error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Confetti ────────────────────────────────────────────────────────────────

  async function fireConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    } catch { }
  }

  // ── Progress calculation ────────────────────────────────────────────────────

  // completedIds.size = cards truly finished (Good/Easy)
  // sessionQueue unique IDs = cards still pending
  // Progress only advances when a card is finished, not when it's re-queued
  const uniqueRemaining = new Set(sessionQueue.map(c => c.id)).size
  const progressPercent = originalTotal > 0
    ? Math.round((completedIds.size / originalTotal) * 100)
    : 0

  // Total reviewed in this session (including re-queue passes)
  const totalReviewed = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy
  const sessionRetention = totalReviewed > 0
    ? Math.round(((sessionStats.good + sessionStats.easy) / totalReviewed) * 100)
    : 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  // STATE: loading
  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // STATE: empty (all caught up)
  if (pageState === 'empty') {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto text-center py-20 px-4">
          {/* Checkmark */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mt-5">You are all caught up!</h1>
          <p className="text-gray-500 mt-2">No cards are due right now.</p>

          {/* Upcoming schedule */}
          {!loadingSchedule && schedule.length > 0 && (
            <div className="mt-8 bg-gray-50 rounded-2xl p-5 text-left">
              <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
            </div>
          )}

          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={() => router.push('/decks')}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              Back to decks
            </button>
            <button
              onClick={() => router.push(`/decks/${deckId}`)}
              className="px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
            >
              View stats
            </button>
          </div>
        </div>
      </PageTransition>
    )
  }

  // STATE: complete (session finished)
  if (pageState === 'complete') {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto py-12 px-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900">Session complete!</h1>
            <p className={`text-sm mt-1 font-medium ${sessionRetention >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
              {sessionRetention >= 70
                ? 'Great work — strong retention!'
                : 'Keep going — practice builds memory.'}
            </p>
          </div>

          {/* Session stats */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Again', value: sessionStats.again, color: 'bg-red-50 text-red-600' },
              { label: 'Hard', value: sessionStats.hard, color: 'bg-orange-50 text-orange-600' },
              { label: 'Good', value: sessionStats.good, color: 'bg-blue-50 text-blue-600' },
              { label: 'Easy', value: sessionStats.easy, color: 'bg-green-50 text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${color} rounded-xl py-3 text-center`}>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Retention rate */}
          <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Session retention</span>
            <span className="text-sm font-semibold text-gray-800">{sessionRetention}%</span>
          </div>

          {/* ── Upcoming schedule (the key addition) ── */}
          {/* This shows the student WHEN to come back.
              Without this, SM-2 schedules cards but the student never knows. */}
          {!loadingSchedule && schedule.length > 0 && (
            <div className="mt-6 bg-gray-50 rounded-2xl p-5">
              <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
            </div>
          )}
          {loadingSchedule && (
            <div className="mt-6 bg-gray-50 rounded-2xl p-5 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={fetchDueCards}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              Study again
            </button>
            <button
              onClick={() => router.push('/decks')}
              className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
            >
              Back to decks
            </button>
          </div>
        </div>
      </PageTransition>
    )
  }

  // STATE: studying (main study UI)
  const currentCard = sessionQueue[0]
  if (!currentCard) return null

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        {/* Shows truly COMPLETED cards / original total
            Does NOT advance when a card is re-queued (Again)
            This makes it honest — the bar only moves when you genuinely learn a card */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {completedIds.size} of {originalTotal} learned
          </span>
          <span className="text-xs text-gray-400">
            {uniqueRemaining} card{uniqueRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-8">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ── Re-queue indicator ───────────────────────────────────────────── */}
        {/* Shows when a card has been seen before this session — tells the student
            they are in a re-queue pass (only happens with Again) */}
        {sessionStats.again > 0 && (
          <AnimatePresence>
            {sessionQueue.filter(c => c.id === currentCard.id).length > 1 ||
              (completedIds.size === 0 && sessionStats.again > 0 &&
                sessionQueue.findIndex(c => c.id === currentCard.id) > 0) ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center mb-3"
              >
                <span className="text-xs bg-orange-50 text-orange-500 px-3 py-1 rounded-full">
                  Reviewing again — this card came back
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        {/* ── Flash card ───────────────────────────────────────────────────── */}
        <FlashCard
          front={currentCard.front}
          back={currentCard.back}
          topic={currentCard.topic}
          type={currentCard.type as any}
          source={currentCard.source as any}
          isFlipped={isFlipped}
          onFlip={() => !isFlipped && setIsFlipped(true)}
        />

        {/* ── Rating buttons (appear after flip) ──────────────────────────── */}
        <AnimatePresence>
          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-6"
            >
              {/* Explanation of what the buttons do — makes SM-2 visible */}
              <p className="text-xs text-center text-gray-400 mb-3">
                Again → card comes back this session.
                Hard/Good/Easy → scheduled for later (see intervals below).
              </p>

              <RatingButtons
                onRate={handleRate}
                disabled={isSubmitting}
                cardEaseFactor={currentCard.easeFactor}
                cardInterval={currentCard.interval}
                cardRepetitions={currentCard.repetitions}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Space bar hint */}
        {!isFlipped && (
          <p className="text-center text-xs text-gray-300 mt-6">
            Press Space to reveal
          </p>
        )}

      </div>
    </PageTransition>
  )
}