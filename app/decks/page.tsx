'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DeckCard from '@/components/DeckCard'
import EmptyState from '@/components/EmptyState'
import { PageTransition } from '@/components/PageTransition'

interface Deck {
  id: string
  title: string
  fileName: string
  createdAt: string
  lastStudied: string | null
  _count: { cards: number }
}

interface DeckStats {
  masteryPercent: number
  dueToday: number
  mastered: number
  shaky: number
  newCards: number
  total: number
}

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, DeckStats>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // 1. Fetch all decks
        const res = await fetch('/api/decks')
        const data = await res.json()
        const deckList: Deck[] = data.decks || []

        // 2. Fetch all stats in parallel
        const statsArr = await Promise.all(
          deckList.map((d) =>
            fetch(`/api/stats?deckId=${d.id}`).then((r) => r.json())
          )
        )

        // 3. Build statsMap
        const map: Record<string, DeckStats> = {}
        deckList.forEach((d, i) => {
          map[d.id] = statsArr[i]
        })

        setDecks(deckList)
        setStatsMap(map)
      } catch {
        // silent fail — empty state will show
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Sort decks: due today first → lastStudied desc → createdAt desc
  const sortedDecks = [...decks].sort((a, b) => {
    const aDue = statsMap[a.id]?.dueToday ?? 0
    const bDue = statsMap[b.id]?.dueToday ?? 0

    // 1. dueToday > 0 first
    if (aDue > 0 && bDue === 0) return -1
    if (bDue > 0 && aDue === 0) return 1

    // 2. lastStudied desc
    const aStudied = a.lastStudied ? new Date(a.lastStudied).getTime() : 0
    const bStudied = b.lastStudied ? new Date(b.lastStudied).getTime() : 0
    if (aStudied !== bStudied) return bStudied - aStudied

    // 3. createdAt desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Search filter (rename from whatever it was to be explicit)
  const filteredDecks = sortedDecks.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Summary totals
  const totalCards = decks.reduce((sum, d) => sum + d._count.cards, 0)
  
  // Total cards due today across all decks
  const totalDue = Object.values(statsMap).reduce((sum, s) => sum + (s?.dueToday ?? 0), 0)

  // Find the nearest next review date for the "all caught up" message
  // This requires fetching /api/schedule for each deck — skip this for now and
  // set nextDueDate to null (you can add it later):
  const nextDueDate: string | null = null

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-gray-200 animate-pulse rounded-2xl h-10 w-40 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 animate-pulse rounded-2xl h-44"
              />
            ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (decks.length === 0) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <EmptyState
            title="No decks yet"
            description="Upload your first PDF to get started"
            actionLabel="Upload a PDF"
            actionHref="/"
          />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="pt-8 pb-4">
          {/* Page title row */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Decks</h1>
              <p className="text-sm text-gray-400 mt-1">{decks.length} deck{decks.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/" className="shrink-0 ml-4 px-4 py-2.5 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors">
              + Upload PDF
            </Link>
          </div>

          {/* ── Due today hero banner ──────────────────────────────────────────── */}
          {/* This is the core spaced repetition call to action.
              When cards are due, this should be the FIRST thing the student sees. */}
          {totalDue > 0 && (
            <div className="mt-5 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-blue-800 font-semibold text-lg">
                  {totalDue} card{totalDue !== 1 ? 's' : ''} due today
                </p>
                <p className="text-blue-600 text-sm mt-0.5">
                  Across {decks.filter(d => (statsMap[d.id]?.dueToday ?? 0) > 0).length} deck{decks.filter(d => (statsMap[d.id]?.dueToday ?? 0) > 0).length !== 1 ? 's' : ''}
                </p>
              </div>
              {/* If there is only one deck with due cards, go directly to study.
                  If multiple, let the user pick from the list below. */}
              {decks.filter(d => (statsMap[d.id]?.dueToday ?? 0) > 0).length === 1 ? (
                <Link
                  href={`/decks/${decks.find(d => (statsMap[d.id]?.dueToday ?? 0) > 0)?.id}/study`}
                  className="shrink-0 px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Study now →
                </Link>
              ) : (
                <span className="text-blue-400 text-sm">↓ Pick a deck below</span>
              )}
            </div>
          )}

          {/* All caught up banner */}
          {totalDue === 0 && decks.length > 0 && (
            <div className="mt-5 bg-green-50 border border-green-100 rounded-2xl px-5 py-4">
              <p className="text-green-700 font-medium">✓ All caught up — no reviews due today</p>
              <p className="text-green-600 text-sm mt-0.5">
                {nextDueDate ? `Next review: ${nextDueDate}` : 'Keep studying to build your streak'}
              </p>
            </div>
          )}

          {/* Search */}
          <div className="mt-5">
            <input
              type="text"
              placeholder="Search decks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Deck grid */}
        {filteredDecks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
            {filteredDecks.map(deck => (
              <DeckCard key={deck.id} deck={deck} stats={statsMap[deck.id]} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 mt-12 pb-8">
            No decks match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>
    </PageTransition>
  )
}
