'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
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
  mastered: number
  shaky: number
  newCards: number
  masteryPercent: number
  retentionRate: number
  streak: number
}

type FilterTab = 'all' | 'due' | 'mastered' | 'shaky' | 'new'

const typeBadgeStyles: Record<string, string> = {
  definition: 'bg-gray-100 text-gray-700',
  application: 'bg-green-100 text-green-700',
  relationship: 'bg-purple-100 text-purple-700',
  edge_case: 'bg-orange-100 text-orange-700',
}

function easeBarColor(ef: number): string {
  if (ef >= 2.2) return 'bg-green-400'
  if (ef >= 1.8) return 'bg-yellow-400'
  return 'bg-red-400'
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
  const [showUpcomingCards, setShowUpcomingCards] = useState(false)

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
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [deckId])

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

  // Filter cards by active tab
  // Thresholds must match /api/stats definitions:
  //   Mastered: repetitions >= 2 AND easeFactor >= 2.0
  //   Shaky:    repetitions >= 1 but NOT mastered
  //   New:      repetitions === 0
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-gray-200 animate-pulse rounded-2xl h-10 w-64 mb-4" />
        <div className="bg-gray-200 animate-pulse rounded-2xl h-4 w-48 mb-8" />
        <div className="flex gap-8">
          <div className="bg-gray-200 animate-pulse rounded-full w-40 h-40" />
          <div className="flex-1 space-y-3">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-200 animate-pulse rounded h-4 w-36"
                />
              ))}
          </div>
        </div>
      </div>
    )
  }

  if (!deck || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Deck not found</p>
      </div>
    )
  }

  const filteredCards = filterCards(deck.cards)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'due', label: 'Due today' },
    { key: 'mastered', label: 'Mastered' },
    { key: 'shaky', label: 'Shaky' },
    { key: 'new', label: 'New' },
  ]

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* ── SECTION 1 — Header ── */}
        <h1 className="text-3xl font-bold text-gray-900">{deck.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {deck.fileName} · Created {relativeDate(deck.createdAt)}
        </p>

        <div className="flex gap-3 mt-4">
          <Link
            href={`/decks/${deckId}/study`}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Study now
          </Link>
          <button
            onClick={handleDelete}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
          >
            Delete deck
          </button>
        </div>

        {/* ── SECTION 2 — Stats row ── */}
        <div className="flex flex-wrap gap-8 mt-8 items-start">
          <MasteryRing
            mastered={stats.mastered}
            shaky={stats.shaky}
            newCards={stats.newCards}
            total={stats.total}
            size={160}
          />

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <span className="text-gray-500">Total cards</span>
            <span className="font-medium text-gray-800">{stats.total}</span>

            <span className="text-gray-500">Due today</span>
            <span className="font-medium text-gray-800">{stats.dueToday}</span>

            <span className="text-gray-500">Study streak</span>
            <span className="font-medium text-gray-800">
              {stats.streak} day{stats.streak !== 1 ? 's' : ''} 🔥
            </span>

            <span className="text-gray-500">Retention</span>
            <span className="font-medium text-gray-800">
              {(stats.retentionRate * 100).toFixed(0)}%
            </span>

            <span className="text-gray-500">Last studied</span>
            <span className="font-medium text-gray-800">
              {relativeDate(deck.lastStudied)}
            </span>
          </div>
        </div>

        {/* ── SECTION 3 — Upcoming Schedule ── */}
        {schedule.length > 0 && (
          <div className="mt-10 bg-gray-50 rounded-2xl p-6">
            <UpcomingSchedule schedule={schedule} nextReviewAt={nextReviewAt} />
            
            {/* Show scheduled cards toggle */}
            <div className="mt-6 flex flex-col items-center border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowUpcomingCards(!showUpcomingCards)}
                className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
              >
                {showUpcomingCards ? "Hide scheduled cards ↑" : "Show scheduled cards ↓"}
              </button>
              
              {showUpcomingCards && (
                <div className="mt-4 w-full max-h-80 overflow-y-auto pr-2 space-y-2">
                  {deck.cards
                    .filter(c => new Date(c.dueDate) > new Date())
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                    .map(card => (
                    <div key={card.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-4 shadow-sm">
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {card.front}
                      </span>
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap shrink-0 bg-gray-50 px-2 py-1 rounded-lg">
                        Due {relativeDate(card.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SECTION 4 — Card list ── */}
        <div className="mt-10">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Card rows */}
          {filteredCards.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No cards match this filter
            </p>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="border-b border-gray-100 py-3 flex items-center gap-3"
              >
                {/* Front text */}
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                  {card.front.length > 80
                    ? card.front.slice(0, 80) + '…'
                    : card.front}
                </span>

                {/* Topic badge */}
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {card.topic}
                </span>

                {/* Type badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    typeBadgeStyles[card.type] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {card.type.replace('_', ' ')}
                </span>

                {/* Due date */}
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  Due {relativeDate(card.dueDate)}
                </span>

                {/* Ease bar */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${easeBarColor(
                      card.easeFactor
                    )}`}
                    style={{ width: `${easeBarWidth(card.easeFactor)}%` }}
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
