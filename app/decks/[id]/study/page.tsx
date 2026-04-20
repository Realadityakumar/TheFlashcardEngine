'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import FlashCard from '@/components/FlashCard'
import RatingButtons from '@/components/RatingButtons'
import { PageTransition } from '@/components/PageTransition'
import { UpcomingSchedule } from '@/components/UpcomingSchedule'

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

interface SessionStats {
  again: number
  hard: number
  good: number
  easy: number
}

export default function StudyPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string

  const [sessionQueue, setSessionQueue] = useState<Card[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [originalTotal, setOriginalTotal] = useState(0)

  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [pageState, setPageState] = useState<SessionState>('loading')

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  const [deckTitle, setDeckTitle] = useState('Deck')

  useEffect(() => {
    fetch('/api/decks').then(r => r.json()).then(data => {
      const d = data.decks?.find((deck: any) => deck.id === deckId)
      if (d) setDeckTitle(d.title)
    }).catch(() => {})
  }, [deckId])

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
        fetchSchedule() 
      } else {
        setSessionQueue(data.cards)
        setOriginalTotal(data.cards.length)
        setPageState('studying')
      }
    } catch (err) {
      setPageState('empty')
    }
  }, [deckId])

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
    } finally {
      setLoadingSchedule(false)
    }
  }, [deckId])

  useEffect(() => {
    fetchDueCards()
  }, [fetchDueCards])

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

  async function handleRate(rating: 0 | 1 | 2 | 3) {
    if (isSubmitting || sessionQueue.length === 0) return
    setIsSubmitting(true)

    const currentCard = sessionQueue[0]

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCard.id, rating }),
      })

      if (!res.ok) throw new Error('Review save failed')
      const data = await res.json()

      const statKey = ['again', 'hard', 'good', 'easy'][rating] as keyof SessionStats
      setSessionStats(prev => ({ ...prev, [statKey]: prev[statKey] + 1 }))

      if (rating === 0) {
        const updatedCard: Card = {
          ...currentCard,
          easeFactor: data.card.easeFactor,
          interval: data.card.interval,
          repetitions: data.card.repetitions,
        }
        setSessionQueue(q => [...q.slice(1), updatedCard])
      } else {
        setCompletedIds(prev => new Set([...prev, currentCard.id]))
        const newQueue = sessionQueue.slice(1)
        setSessionQueue(newQueue)

        if (newQueue.length === 0) {
          fireConfetti()
          await fetchSchedule()
          setPageState('complete')
          return
        }
      }
      setIsFlipped(false)
    } catch (err) {
    } finally {
      setIsSubmitting(false)
    }
  }

  async function fireConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    } catch { }
  }

  const uniqueRemaining = new Set(sessionQueue.map(c => c.id)).size
  const progressPercent = originalTotal > 0
    ? Math.round((completedIds.size / originalTotal) * 100)
    : 0

  useEffect(() => {
    if (pageState === 'studying') {
      gsap.to('.progress-fill', {
        width: `${progressPercent}%`,
        duration: 0.6,
        ease: 'power2.out'
      })
    }
  }, [progressPercent, pageState])

  const totalReviewed = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy
  const sessionRetention = totalReviewed > 0
    ? Math.round(((sessionStats.good + sessionStats.easy) / totalReviewed) * 100)
    : 0

  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (pageState === 'empty') {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center px-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-[72px] h-[72px] flex items-center justify-center rounded-full"
            style={{ background: 'rgba(0,229,160,0.1)', border: '2px solid rgba(0,229,160,0.2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
              <path stroke="#00e5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#f0f0ff] mt-5">
            You're all caught up!
          </h1>
          <p className="text-sm text-[#8888aa] mt-2">
            No cards are due right now.
          </p>

          {!loadingSchedule && schedule.length > 0 && (
            <div className="glass rounded-[16px] p-5 mt-6 text-left w-full">
              <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
            </div>
          )}

          <div className="flex gap-3 justify-center mt-8 w-full">
            <button
              onClick={() => router.push('/decks')}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-[#8888aa] text-sm hover:text-[#f0f0ff] hover:border-[rgba(255,255,255,0.15)] transition-colors"
            >
              Back to decks
            </button>
            <button
              onClick={() => router.push(`/decks/${deckId}`)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm transition-all focus:outline-none hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #00d2ff)' }}
            >
              View stats
            </button>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (pageState === 'complete') {
    return (
      <PageTransition>
        <motion.div 
          className="max-w-md mx-auto py-12 px-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-gradient">
              Session complete
            </h1>
            <p className="text-sm mt-3 text-[#4a4a6a]">
              {sessionRetention >= 70
                ? 'Great work — strong retention!'
                : 'Keep going — practice builds memory.'}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-8">
            {[
              { label: 'Again', value: sessionStats.again, bg: 'rgba(255,77,109,0.08)', color: '#ff4d6d' },
              { label: 'Hard', value: sessionStats.hard, bg: 'rgba(255,181,71,0.08)', color: '#ffb547' },
              { label: 'Good', value: sessionStats.good, bg: 'rgba(108,99,255,0.08)', color: '#6c63ff' },
              { label: 'Easy', value: sessionStats.easy, bg: 'rgba(0,229,160,0.08)', color: '#00e5a0' },
            ].map(({ label, value, bg, color }) => (
              <div key={label} className="rounded-[14px] py-[14px] px-[8px] text-center" style={{ background: bg, color }}>
                <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold leading-none">{value}</div>
                <div className="text-xs mt-1.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 glass rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#8888aa]">Retention rate</span>
            <span className="font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: sessionRetention >= 70 ? '#00e5a0' : '#ffb547' }}>
              {sessionRetention}%
            </span>
          </div>

          {!loadingSchedule && schedule.length > 0 && (
            <div className="mt-5 glass rounded-2xl p-5">
              <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
            </div>
          )}
          {loadingSchedule && (
            <div className="mt-5 glass rounded-2xl p-5 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[rgba(255,255,255,0.1)] border-t-[#6c63ff] rounded-full animate-spin" />
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={fetchDueCards}
              className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.08)] text-[#8888aa] text-sm hover:text-[#f0f0ff] hover:border-[rgba(255,255,255,0.15)] transition-colors focus:outline-none"
            >
              Study again
            </button>
            <button
              onClick={() => router.push('/decks')}
              className="flex-1 py-3 rounded-xl text-white text-sm transition-all focus:outline-none hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #00d2ff)' }}
            >
              Back to decks
            </button>
          </div>
        </motion.div>
      </PageTransition>
    )
  }

  const currentCard = sessionQueue[0]
  if (!currentCard) return null

  return (
    <PageTransition>
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <Link 
          href={`/decks/${deckId}`}
          className="inline-block text-xs text-[#4a4a6a] hover:text-[#8888aa] transition-colors mb-4"
        >
          ← {deckTitle}
        </Link>
        
        {/* Stats row */}
        <div className="mb-2 flex items-center justify-between">
          <span className="font-[family-name:var(--font-mono)] text-xs text-[#4a4a6a]">
            {completedIds.size} of {originalTotal}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-[#4a4a6a]">
            {uniqueRemaining} remaining
          </span>
        </div>

        {/* Progress bar container */}
        <div className="w-full bg-[#161625] rounded-[99px] h-1 mb-8 overflow-hidden progress-bar-track">
          <div
            className="progress-fill h-full rounded-[99px]"
            style={{ 
              width: '0%', 
              background: 'linear-gradient(90deg, #6c63ff, #00d2ff)'
            }}
          />
        </div>

        {/* Re-queue indicator */}
        {sessionStats.again > 0 && (
          <AnimatePresence>
            {sessionQueue.filter(c => c.id === currentCard.id).length > 1 ||
              (completedIds.size === 0 && sessionStats.again > 0 &&
                sessionQueue.findIndex(c => c.id === currentCard.id) > 0) ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center mb-4"
              >
                <span 
                  className="text-xs px-3 py-1.5 rounded-full mx-auto w-fit"
                  style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.15)', color: '#ffb547' }}
                >
                  ↩ Reviewing again
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        <FlashCard
          front={currentCard.front}
          back={currentCard.back}
          topic={currentCard.topic}
          type={currentCard.type as any}
          source={currentCard.source as any}
          isFlipped={isFlipped}
          onFlip={() => !isFlipped && setIsFlipped(true)}
        />

        {isFlipped ? (
          <div className="mt-8">
            <RatingButtons
              onRate={handleRate}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <div className="text-center mt-8">
            <p className="text-xs text-[#4a4a6a]">
              Press <span 
                className="font-[family-name:var(--font-mono)] px-2 py-0.5 rounded-[6px] mx-1 inline-block"
                style={{ background: '#161625', border: '1px solid #1e1e30', borderBottomWidth: '3px', color: '#4a4a6a' }}
              >Space</span> to reveal
            </p>
          </div>
        )}

      </div>
    </PageTransition>
  )
}