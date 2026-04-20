'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { gsap } from 'gsap'
import MasteryRing from '@/components/MasteryRing'
import { PageTransition } from '@/components/PageTransition'
import { UpcomingSchedule } from '@/components/UpcomingSchedule'
import { relativeDate } from '@/lib/utils'

interface ScheduleEntry {
  date: string
  count: number
  isToday: boolean
  label: string
}

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

interface Deck {
  id: string
  title: string
  fileName: string
  createdAt: string
  lastStudied: string | null
  cards: Card[]
}

interface Stats {
  total: number
  dueToday: number
  reviewedToday: number
  mastered: number
  shaky: number
  newCards: number
  masteryPercent: number
  retentionRate: number
  streak: number
}

type FilterTab = 'all' | 'due' | 'mastered' | 'shaky' | 'new'

const typeBadgeStyles: Record<string, { bg: string; color: string }> = {
  definition: { bg: 'rgba(255,255,255,0.06)', color: '#8888aa' },
  application: { bg: 'rgba(0,229,160,0.08)', color: '#00e5a0' },
  relationship: { bg: 'rgba(0,210,255,0.08)', color: '#00d2ff' },
  edge_case: { bg: 'rgba(255,181,71,0.08)', color: '#ffb547' }
}

function easeBarColor(ef: number): string {
  if (ef >= 2.2) return '#00e5a0'
  if (ef >= 1.8) return '#ffb547'
  return '#ff4d6d'
}

function easeBarWidth(ef: number): number {
  return Math.max(0, Math.min(100, ((ef - 1.3) / (3.0 - 1.3)) * 100))
}

export default function DeckDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.id as string

  const [deck, setDeck] = useState<Deck | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    async function load() {
      try {
        const [deckRes, statsRes, scheduleRes] = await Promise.all([
          fetch(`/api/decks?id=${deckId}`),
          fetch(`/api/stats?deckId=${deckId}`),
          fetch(`/api/schedule?deckId=${deckId}`),
        ])
        const [deckData, statsData, scheduleData] = await Promise.all([
          deckRes.json(),
          statsRes.json(),
          scheduleRes.json(),
        ])
        setDeck(deckData.deck)
        setStats(statsData)
        if (scheduleRes.ok) {
          setSchedule(scheduleData.schedule)
          setNextReviewAt(scheduleData.nextReviewAt)
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [deckId])

  useEffect(() => {
    if (stats && !loading) {
      const targets = gsap.utils.toArray<HTMLElement>('.gsap-counter')
      targets.forEach((target, i) => {
        const finalValue = parseFloat(target.dataset.value || '0')
        gsap.fromTo(target,
          { innerText: 0 },
          {
            innerText: finalValue,
            duration: 1,
            ease: 'power2.out',
            snap: { innerText: 1 },
            delay: i * 0.1,
            onUpdate: function() {
              if (target) {
                const suffix = target.dataset.suffix || ''
                target.textContent = Math.round(Number(this.targets()[0].innerText)) + suffix
              }
            }
          }
        )
      })

      gsap.fromTo('.stat-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out' }
      )
      gsap.fromTo('.card-list-row',
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out', delay: 0.3 }
      )
    }
  }, [stats, loading])

  async function handleDelete() {
    if (!confirm('Delete this deck? This cannot be undone.')) return
    try {
      await fetch(`/api/decks?id=${deckId}`, { method: 'DELETE' })
      toast.success('Deck deleted')
      router.push('/decks')
    } catch {
      toast.error('Failed to delete deck')
    }
  }

  function filterCards(cards: Card[]): Card[] {
    const now = new Date()
    switch (activeTab) {
      case 'due':
        return cards.filter((c) => new Date(c.dueDate) <= now)
      case 'mastered':
        return cards.filter((c) => c.repetitions >= 2 && c.easeFactor >= 2.0)
      case 'shaky':
        return cards.filter(
          (c) =>
            c.repetitions >= 1 &&
            !(c.repetitions >= 2 && c.easeFactor >= 2.0)
        )
      case 'new':
        return cards.filter((c) => c.repetitions === 0)
      default:
        return cards
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6 w-full">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shimmer {
            0% { background-position: -200% 0 }
            100% { background-position: 200% 0 }
          }
          .shimmer-bg {
            background: linear-gradient(90deg, #0f0f1a 25%, #161625 50%, #0f0f1a 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border: 1px solid rgba(255,255,255,0.04);
            background-color: #0f0f1a;
          }
        `}} />
        <div className="shimmer-bg rounded-2xl h-10 w-64 mb-4" />
        <div className="shimmer-bg rounded-2xl h-4 w-48 mb-8" />
        <div className="flex gap-8">
          <div className="shimmer-bg rounded-full w-40 h-40 shrink-0" />
          <div className="flex-1 space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="shimmer-bg rounded h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!deck || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#8888aa]">Deck not found</p>
      </div>
    )
  }

  const filteredCards = filterCards(deck.cards)
  const todayPendingTotal = stats.dueToday + stats.reviewedToday
  const todayCompletedPercent = todayPendingTotal > 0
    ? Math.round((stats.reviewedToday / todayPendingTotal) * 100)
    : 100

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'due', label: 'Due today' },
    { key: 'mastered', label: 'Mastered' },
    { key: 'shaky', label: 'Shaky' },
    { key: 'new', label: 'New' },
  ]

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto py-8 px-6">
        
        {/* ── SECTION 1 — Header ── */}
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-[#f0f0ff]">
          {deck.title}
        </h1>
        <div className="text-sm text-[#4a4a6a] mt-1 flex gap-2 items-center">
          <span>{deck.fileName}</span>
          <span className="text-[#4a4a6a]">·</span>
          <span>Created {relativeDate(deck.createdAt)}</span>
        </div>

        <div className="flex gap-3 mt-5">
          <Link
            href={`/decks/${deckId}/study`}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #6c63ff, #00d2ff)',
              boxShadow: '0 4px 15px rgba(108,99,255,0.25)'
            }}
          >
            Study now
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-transparent delete-btn"
            style={{ border: '1px solid rgba(255,77,109,0.2)', color: '#ff4d6d' }}
          >
            <style dangerouslySetInnerHTML={{__html: `
              .delete-btn:hover {
                background: rgba(255,77,109,0.08);
              }
            `}} />
            Delete deck
          </button>
        </div>

        {/* Divider */}
        <div className="w-full h-px mt-8 mb-8" style={{ background: 'rgba(255,255,255,0.04)' }} />

        {/* ── SECTION 2 — Stats row ── */}
        <div className="flex flex-wrap gap-8 items-start">
          <div className="shrink-0">
            <div className="flex flex-col items-center">
              <MasteryRing
                dueToday={stats.dueToday}
                reviewedToday={stats.reviewedToday}
                total={stats.total}
                mode="due"
                size={180}
              />
              <p className="text-xs text-[#8888aa] mt-2 text-center">
                Today: <span className="font-mono text-[#f0f0ff]">{stats.reviewedToday}/{todayPendingTotal}</span> done ({todayCompletedPercent}%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="stat-card bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] p-[14px_16px] flex flex-col opacity-0">
              <span className="text-xs text-[#4a4a6a] uppercase tracking-wide mb-1">Total cards</span>
              <span className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-[#f0f0ff] gsap-counter" data-value={stats.total}>0</span>
            </div>

            <div className="stat-card bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] p-[14px_16px] flex flex-col opacity-0">
              <span className="text-xs text-[#4a4a6a] uppercase tracking-wide mb-1">Due today</span>
              <span 
                className="font-[family-name:var(--font-mono)] text-2xl font-semibold gsap-counter"
                style={{ color: stats.dueToday > 0 ? '#6c63ff' : '#f0f0ff' }}
                data-value={stats.dueToday}
              >0</span>
            </div>

            <div className="stat-card bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] p-[14px_16px] flex flex-col opacity-0">
              <span className="text-xs text-[#4a4a6a] uppercase tracking-wide mb-1">Study streak</span>
              <span 
                className="font-[family-name:var(--font-mono)] text-2xl font-semibold gsap-counter"
                style={{ color: stats.streak > 0 ? '#ffb547' : '#f0f0ff' }}
                data-value={stats.streak}
                data-suffix={stats.streak === 1 ? ' day 🔥' : ' days 🔥'}
              >0</span>
            </div>

            <div className="stat-card bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[14px] p-[14px_16px] flex flex-col opacity-0">
              <span className="text-xs text-[#4a4a6a] uppercase tracking-wide mb-1">Retention</span>
              <span 
                className="font-[family-name:var(--font-mono)] text-2xl font-semibold gsap-counter"
                style={{ color: stats.retentionRate >= 0.7 ? '#00e5a0' : '#ffb547' }}
                data-value={Math.round(stats.retentionRate * 100)}
                data-suffix="%"
              >0%</span>
            </div>
          </div>
        </div>

        {/* Progress breakdown + Upcoming reviews */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="glass rounded-[16px] p-5">
            <p className="text-xs font-medium text-[#4a4a6a] uppercase tracking-widest mb-4">
              Card states
            </p>
            <div className="space-y-2">
              <div className="relative group flex items-center justify-between rounded-lg bg-[rgba(0,229,160,0.08)] px-3 py-2 cursor-help">
                <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 w-56 rounded-lg border border-[rgba(0,229,160,0.25)] bg-[#0f0f1a] px-3 py-2 text-[11px] text-[#b8ffe7] leading-relaxed opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-0.5 z-20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  Cards consistently recalled with high confidence, so they will be scheduled less frequently.
                </div>
                <span className="text-xs text-[#00e5a0]">Mastered</span>
                <span className="font-mono text-sm text-[#f0f0ff]">{stats.mastered}</span>
              </div>
              <div className="relative group flex items-center justify-between rounded-lg bg-[rgba(255,181,71,0.08)] px-3 py-2 cursor-help">
                <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 w-56 rounded-lg border border-[rgba(255,181,71,0.25)] bg-[#0f0f1a] px-3 py-2 text-[11px] text-[#ffe5c2] leading-relaxed opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-0.5 z-20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  Cards that need reinforcement. You have seen them, but recall is still unstable.
                </div>
                <span className="text-xs text-[#ffb547]">Shaky</span>
                <span className="font-mono text-sm text-[#f0f0ff]">{stats.shaky}</span>
              </div>
              <div className="relative group flex items-center justify-between rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 cursor-help">
                <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 w-56 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[#0f0f1a] px-3 py-2 text-[11px] text-[#d7d7e8] leading-relaxed opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-0.5 z-20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  Fresh cards not yet learned successfully. These should be introduced and reviewed soon.
                </div>
                <span className="text-xs text-[#8888aa]">New</span>
                <span className="font-mono text-sm text-[#f0f0ff]">{stats.newCards}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-[16px] p-6">
            <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
          </div>
        </div>

        {/* ── SECTION 3 — Card list ── */}
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#f0f0ff] mt-8 mb-4">
          Cards
        </h2>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  text-xs px-3 py-1.5 rounded-full border transition duration-150
                  ${isActive 
                    ? 'bg-[rgba(108,99,255,0.15)] border-[rgba(108,99,255,0.3)] text-[#6c63ff] font-medium' 
                    : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8888aa] hover:text-[#f0f0ff]'}
                `}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Card list container */}
        <div className="bg-[#0f0f1a] border border-[rgba(255,255,255,0.04)] rounded-[16px] overflow-hidden">
          <style dangerouslySetInnerHTML={{__html: `
            .card-row { transition: background 150ms ease; }
            .card-row:hover { background: rgba(255,255,255,0.02); }
            .card-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.04); }
          `}} />

          {filteredCards.length === 0 ? (
            <p className="text-sm text-[#8888aa] py-8 text-center">
              No cards match this filter
            </p>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="card-row card-list-row px-4 py-3 flex items-center gap-3 opacity-0"
              >
                {/* Front text */}
                <span className="flex-1 text-sm text-[#e0e0f0] truncate">
                  {card.front}
                </span>

                {/* Topic badge */}
                <span 
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
                  style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', color: '#6c63ff' }}
                >
                  {card.topic}
                </span>

                {/* Type badge */}
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
                  style={{ 
                    background: typeBadgeStyles[card.type]?.bg || 'rgba(255,255,255,0.06)', 
                    color: typeBadgeStyles[card.type]?.color || '#8888aa' 
                  }}
                >
                  {card.type.replace('_', ' ')}
                </span>

                {/* Due date */}
                <span className="font-[family-name:var(--font-mono)] text-xs text-[#4a4a6a] whitespace-nowrap shrink-0">
                  {relativeDate(card.dueDate)}
                </span>

                {/* Ease bar */}
                <div className="w-12 h-1 bg-[#161625] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${easeBarWidth(card.easeFactor)}%`,
                      background: easeBarColor(card.easeFactor)
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  )
}
