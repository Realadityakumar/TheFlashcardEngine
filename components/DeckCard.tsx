'use client'

import Link from 'next/link'
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
    reviewedToday?: number
    mastered: number
    shaky: number
    newCards: number
    total: number
  }
}

export default function DeckCard({ deck, stats }: DeckCardProps) {
  return (
    <div 
      className="bg-[#0f0f1a] rounded-[20px] p-[20px_22px] overflow-hidden relative group transition-all duration-200 hover:-translate-y-[2px] hover:border-[rgba(108,99,255,0.2)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.06)] flex flex-col h-full"
    >
      {/* Top-right corner decoration */}
      <div 
        className="absolute top-0 right-0 w-[80px] h-[80px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, rgba(108,99,255,0.08) 0%, transparent 70%)'
        }}
      />

      {/* Row 1: Title + MasteryRing */}
      <div className="flex items-start justify-between relative z-10 w-full mb-1">
        <h3 className="font-[family-name:var(--font-display)] font-semibold text-lg text-[#f0f0ff] truncate pr-4 max-w-[calc(100%-80px)]" title={deck.title}>
          {deck.title}
        </h3>
        <div className="shrink-0 flex justify-end min-w-[72px]">
          {/* We pass only what is required to MasteryRing */}
          <MasteryRing
            mastered={stats?.mastered ?? 0}
            shaky={stats?.shaky ?? 0}
            newCards={stats?.newCards ?? 0}
            dueToday={stats?.dueToday ?? 0}
            reviewedToday={stats?.reviewedToday ?? 0}
            total={stats?.total ?? 0}
            mode="due"
            size={72}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10 mt-[-60px]"> {/* Negative margin to offset MasteryRing height on the right */}
        {/* Row 2: File name */}
        <p className="text-xs text-[#4a4a6a] mt-1 flex items-center gap-1.5 truncate max-w-[calc(100%-80px)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <span className="truncate">{deck.fileName}</span>
        </p>

        {/* Row 3: Stats pills row */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-xs text-[#8888aa] px-2.5 py-1 rounded-full">
            {deck._count.cards} cards
          </span>
          {stats && stats.dueToday > 0 ? (
            <span className="bg-[rgba(255,181,71,0.1)] border border-[rgba(255,181,71,0.2)] text-xs text-[#ffb547] px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="text-[8px] mt-[1px]">●</span> {stats.dueToday} due today
            </span>
          ) : stats ? (
            <span className="bg-[rgba(0,229,160,0.08)] border border-[rgba(0,229,160,0.15)] text-xs text-[#00e5a0] px-2.5 py-1 rounded-full flex items-center gap-1">
              ✓ caught up
            </span>
          ) : null}
        </div>

        {/* Row 4: Last studied */}
        <p className="text-xs text-[#4a4a6a] mt-2">
          {deck.lastStudied ? `Last studied ${relativeDate(deck.lastStudied)}` : 'Never studied'}
        </p>
      </div>

      <div className="mt-auto relative z-10 w-full pt-4">
        {/* Divider */}
        <div className="w-full h-px bg-[rgba(255,255,255,0.04)] mb-4" />

        {/* Row 5: Action buttons */}
        <div className="flex gap-2 font-[family-name:var(--font-body)]">
          <Link
            href={`/decks/${deck.id}/study`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-center px-4 py-2 rounded-[10px] text-sm font-medium text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-[1px]"
            style={{
              background: 'linear-gradient(135deg, #6c63ff, #5a52e0)',
              boxShadow: '0 4px 12px rgba(108,99,255,0.25)'
            }}
          >
            Study now
          </Link>
          <Link
            href={`/decks/${deck.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-center px-4 py-2 rounded-[10px] text-sm text-[#8888aa] transition-all duration-200 bg-transparent border border-[rgba(255,255,255,0.08)] hover:text-[#f0f0ff] hover:border-[rgba(255,255,255,0.15)]"
          >
            View deck
          </Link>
        </div>
      </div>
    </div>
  )
}
