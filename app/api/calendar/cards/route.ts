export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  dueDate: Date
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

type TodayStats = {
  dueCount: number
  reviewedToday: number
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateParam(dateParam: string | null): Date | null {
  if (!dateParam) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return null
  const [year, month, day] = dateParam.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function getMasteryState(repetitions: number, easeFactor: number): MasteryState {
  if (repetitions >= 3 && easeFactor >= 2.0) return 'mastered'
  if (repetitions >= 1) return 'learning'
  return 'new'
}

function summarizeDecks(cards: Array<{ deck: { id: string; title: string } }>): DeckSummary[] {
  const map = new Map<string, DeckSummary>()
  for (const card of cards) {
    const deckId = card.deck.id
    const deckTitle = card.deck.title
    const existing = map.get(deckId)
    if (existing) {
      existing.count += 1
    } else {
      map.set(deckId, { deckId, deckTitle, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.deckTitle.localeCompare(b.deckTitle))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const deckIdParam = searchParams.get('deckId')
    const typeParam = searchParams.get('type')

    const targetDate = parseDateParam(dateParam)
    if (!targetDate) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const type = typeParam === 'due' || typeParam === 'reviewed' ? typeParam : null
    if (!type) {
      return NextResponse.json({ error: "type must be 'due' or 'reviewed'" }, { status: 400 })
    }

    const deckId = deckIdParam && deckIdParam.trim().length > 0 ? deckIdParam.trim() : null

    const dayStart = new Date(targetDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(targetDate)
    dayEnd.setHours(23, 59, 59, 999)

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const isToday = formatDateLocal(dayStart) === formatDateLocal(todayStart)

    if (type === 'due') {
      const dueWhere = isToday
        ? {
            OR: [
              { dueDate: { gte: dayStart, lte: dayEnd } },
              { dueDate: { lt: todayStart } },
            ],
          }
        : { dueDate: { gte: dayStart, lte: dayEnd } }

      const reviewedTodayPromise = isToday
        ? prisma.reviewLog.count({
            where: {
              reviewedAt: { gte: todayStart, lte: dayEnd },
              ...(deckId ? { card: { deckId } } : {}),
            },
          })
        : Promise.resolve(0)

      const [cards, reviewedToday] = await Promise.all([
        prisma.card.findMany({
          where: {
            ...dueWhere,
            ...(deckId ? { deckId } : {}),
          },
          select: {
            id: true,
            front: true,
            back: true,
            topic: true,
            type: true,
            source: true,
            easeFactor: true,
            interval: true,
            repetitions: true,
            dueDate: true,
            deck: { select: { id: true, title: true } },
          },
          orderBy: [
            { deck: { title: 'asc' } },
            { topic: 'asc' },
          ],
        }),
        reviewedTodayPromise,
      ])

      const filteredCards = cards.filter(
        (card) => card.deck && card.deck.id && card.deck.title
      )

      const cardsWithState: DueCard[] = filteredCards.map((card) => ({
        ...card,
        deck: card.deck,
        masteryState: getMasteryState(card.repetitions, card.easeFactor),
      }))

      const deckSummary = summarizeDecks(cardsWithState)
      const todayStats: TodayStats | null = isToday
        ? { dueCount: cardsWithState.length, reviewedToday }
        : null

      return NextResponse.json({
        cards: cardsWithState,
        date: formatDateLocal(dayStart),
        totalCount: cardsWithState.length,
        type,
        deckSummary,
        ...(todayStats ? { todayStats } : {}),
      })
    }

    const reviewLogs = await prisma.reviewLog.findMany({
      where: {
        reviewedAt: { gte: dayStart, lte: dayEnd },
        ...(deckId ? { card: { deckId } } : {}),
      },
      select: {
        reviewedAt: true,
        rating: true,
        card: {
          select: {
            id: true,
            front: true,
            topic: true,
            deck: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { reviewedAt: 'asc' },
    })

    const cards: ReviewedCard[] = reviewLogs
      .filter((log) => log.card && log.card.deck)
      .map((log) => ({
        id: log.card.id,
        front: log.card.front,
        topic: log.card.topic,
        deck: log.card.deck,
        rating: log.rating,
      }))

    const deckSummary = summarizeDecks(cards)

    return NextResponse.json({
      cards,
      date: formatDateLocal(dayStart),
      totalCount: cards.length,
      type,
      deckSummary,
    })
  } catch (error) {
    console.error('[calendar cards] error:', error)
    return NextResponse.json({ error: 'Failed to load calendar cards' }, { status: 500 })
  }
}
