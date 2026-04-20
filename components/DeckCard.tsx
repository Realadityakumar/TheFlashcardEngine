'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import MasteryRing from './MasteryRing'
import { relativeDate } from '@/lib/utils'

interface DeckCardProps {
  deck: {
    id: string
    title: string
    fileName: string
    createdAt: string
    lastStudied: string | null
    _count: { cards: number }
  }
  stats?: {
    masteryPercent: number
    dueToday: number
    mastered: number
    shaky: number
    newCards: number
    total: number
  }
}

export default function DeckCard({ deck, stats }: DeckCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.01, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm transition-colors"
    >
      {/* Row 1: Title + MasteryRing */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold text-lg text-gray-800 truncate flex-1">
          {deck.title}
        </h3>
        <MasteryRing
          mastered={stats?.mastered ?? 0}
          shaky={stats?.shaky ?? 0}
          newCards={stats?.newCards ?? 0}
          total={stats?.total ?? 0}
          size={80}
        />
      </div>

      {/* Row 2: File name */}
      <p className="text-xs text-gray-400 mt-1 truncate">{deck.fileName}</p>

      {/* Row 3: Card count + due pill */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-sm text-gray-600">
          {deck._count.cards} cards
        </span>
        {stats && stats.dueToday > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            {stats.dueToday} due today
          </span>
        ) : stats ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            All caught up ✓
          </span>
        ) : null}
      </div>

      {/* Row 4: Last studied */}
      <p className="text-xs text-gray-400 mt-2">
        Last studied: {relativeDate(deck.lastStudied)}
      </p>

      {/* Row 5: Action buttons */}
      <div className="flex gap-2 mt-4">
        <Link
          href={`/decks/${deck.id}/study`}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          Study now
        </Link>
        <Link
          href={`/decks/${deck.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          View deck
        </Link>
      </div>
    </motion.div>
  )
}
