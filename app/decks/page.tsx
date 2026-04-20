'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import DeckCard from '@/components/DeckCard'
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
        const res = await fetch('/api/decks')
        const data = await res.json()
        const deckList: Deck[] = data.decks || []

        const statsArr = await Promise.all(
          deckList.map((d) =>
            fetch(`/api/stats?deckId=${d.id}`).then((r) => r.json())
          )
        )

        const map: Record<string, DeckStats> = {}
        deckList.forEach((d, i) => {
          map[d.id] = statsArr[i]
        })

        setDecks(deckList)
        setStatsMap(map)
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // GSAP animation for deck cards appearance
  useEffect(() => {
    if (loading || decks.length === 0) return
    
    gsap.registerPlugin(ScrollTrigger)
    gsap.fromTo('.deck-card-item',
      { opacity: 0, y: 40 },
      {
        opacity: 1, 
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.deck-grid', start: 'top 80%' }
      }
    )
  }, [loading, decks.length])

  const sortedDecks = [...decks].sort((a, b) => {
    const aDue = statsMap[a.id]?.dueToday ?? 0
    const bDue = statsMap[b.id]?.dueToday ?? 0

    if (aDue > 0 && bDue === 0) return -1
    if (bDue > 0 && aDue === 0) return 1

    const aStudied = a.lastStudied ? new Date(a.lastStudied).getTime() : 0
    const bStudied = b.lastStudied ? new Date(b.lastStudied).getTime() : 0
    if (aStudied !== bStudied) return bStudied - aStudied

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Search filter
  const filteredDecks = sortedDecks.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalDue = Object.values(statsMap).reduce((sum, s) => sum + (s?.dueToday ?? 0), 0)

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="bg-[#1e1e30] animate-pulse rounded-2xl h-10 w-40" />
          <div className="bg-[#1e1e30] animate-pulse rounded-xl h-10 w-32" />
        </div>
        <div className="mb-8 bg-[#1e1e30] animate-pulse rounded-[20px] h-24 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-[#161625] border border-[rgba(255,255,255,0.06)] animate-pulse rounded-2xl h-44" />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (decks.length === 0) {
    return (
      <PageTransition>
        <style dangerouslySetInnerHTML={{__html: `
          .btn-upload {
            background: linear-gradient(135deg, #6c63ff, #00d2ff);
            color: white;
            font-weight: 500;
            font-size: 0.875rem;
            padding: 0.625rem 1.25rem;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(108,99,255,0.3);
            transition: all 200ms ease-out;
          }
          .btn-upload:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(108,99,255,0.4);
          }
        `}} />
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-16 min-h-[70vh] flex flex-col items-center justify-center text-center">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
            <rect x="25" y="35" width="40" height="30" rx="4" fill="#1e1e30" stroke="rgba(108,99,255,0.3)" strokeWidth="2"/>
            <rect x="20" y="25" width="40" height="30" rx="4" transform="rotate(-5 20 25)" fill="#1e1e30" stroke="rgba(108,99,255,0.3)" strokeWidth="2"/>
            <rect x="15" y="15" width="40" height="30" rx="4" transform="rotate(-10 15 15)" fill="#1e1e30" stroke="rgba(108,99,255,0.3)" strokeWidth="2"/>
            <path d="M55 20L57 24L61 25L58 28L59 32L55 30L51 32L52 28L49 25L53 24L55 20Z" fill="rgba(108,99,255,0.8)" />
          </svg>
          <h2 className="text-2xl font-[family-name:var(--font-display)] font-semibold text-[#f0f0ff] mb-2">No decks yet</h2>
          <p className="text-[#8888aa] mb-6">Upload your first PDF to get started building your knowledge base.</p>
          <Link href="/" className="btn-upload inline-flex items-center gap-1.5 focus:outline-none">
            <span className="text-lg leading-none mt-[-2px]">+</span> Upload a PDF
          </Link>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <style dangerouslySetInnerHTML={{__html: `
        .btn-upload {
          background: linear-gradient(135deg, #6c63ff, #00d2ff);
          color: white;
          font-weight: 500;
          font-size: 0.875rem;
          padding: 0.625rem 1.25rem;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(108,99,255,0.3);
          transition: all 200ms ease-out;
        }
        .btn-upload:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(108,99,255,0.4);
        }
        .search-input:focus {
          border-color: rgba(108,99,255,0.4) !important;
          box-shadow: 0 0 0 3px rgba(108,99,255,0.1) !important;
        }
        .action-btn {
          background: rgba(108,99,255,0.15);
          border: 1px solid rgba(108,99,255,0.3);
          transition: background 150ms ease;
        }
        .action-btn:hover {
          background: rgba(108,99,255,0.25);
        }
      `}} />

      <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">
        
        {/* Header area */}
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-[#f0f0ff]">
            My Decks
          </h1>
          <Link href="/" className="btn-upload flex items-center gap-1.5 focus:outline-none">
            <span className="text-lg leading-none mt-[-2px]">+</span> Upload PDF
          </Link>
        </div>

        {/* Due today hero banner */}
        {totalDue > 0 && (
          <div className="mt-8 rounded-[20px] px-6 py-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,210,255,0.08))', border: '1px solid rgba(108,99,255,0.2)' }}>
            <div>
              <p className="font-[family-name:var(--font-mono)] text-4xl font-bold text-gradient">
                {totalDue}
              </p>
              <p className="text-sm text-[#8888aa] mt-1">cards due today</p>
            </div>
            
            <Link
              href={`/decks/${decks.find(d => (statsMap[d.id]?.dueToday ?? 0) > 0)?.id}/study`}
              className="action-btn rounded-full px-5 py-2.5 text-[#6c63ff] font-medium text-sm outline-none"
            >
              Study now →
            </Link>
          </div>
        )}

        {/* All caught up banner */}
        {totalDue === 0 && decks.length > 0 && (
          <div className="mt-8 rounded-[20px] px-6 py-5 flex items-center gap-3" style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.15)' }}>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(0,229,160,0.2)] text-[#00e5a0] text-sm font-bold">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#00e5a0]">All caught up</p>
              <p className="text-sm text-[#4a4a6a]">Keep studying to build your streak</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mt-6 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#4a4a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search decks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input w-full bg-[#0f0f1a] border border-[rgba(255,255,255,0.06)] rounded-xl py-3 pl-11 pr-4 text-[#f0f0ff] placeholder-[#4a4a6a] focus:outline-none transition-all"
          />
        </div>

        {/* Deck grid */}
        {filteredDecks.length > 0 ? (
          <div className="deck-grid grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
            {filteredDecks.map(deck => (
              <div key={deck.id} className="deck-card-item">
                <DeckCard deck={deck} stats={statsMap[deck.id]} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[#4a4a6a] mt-12 pb-8">
            No decks match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>
    </PageTransition>
  )
}
