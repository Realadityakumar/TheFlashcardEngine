export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type DeckBreakdown = { deckId: string; deckTitle: string; count: number }

type FutureDay = {
  date: string
  count: number
  deckBreakdown: DeckBreakdown[]
}

type PastDay = {
  date: string
  reviewed: number
  correct: number
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveMonthYear(monthParam: string | null, yearParam: string | null): { month: number; year: number } {
  const now = new Date()
  const parsedMonth = Number(monthParam)
  const parsedYear = Number(yearParam)

  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : now.getMonth() + 1
  const year = Number.isInteger(parsedYear) && parsedYear >= 1970
    ? parsedYear
    : now.getFullYear()

  return { month, year }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deckIdParam = searchParams.get('deckId')
    const deckId = deckIdParam && deckIdParam.trim().length > 0 ? deckIdParam.trim() : null

    const { month, year } = resolveMonthYear(
      searchParams.get('month'),
      searchParams.get('year')
    )

    const rangeStart = new Date(year, month - 1, 1)
    const rangeEnd = new Date(year, month, 0, 23, 59, 59, 999)

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const cardsPromise = prisma.card.findMany({
      where: {
        dueDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        ...(deckId ? { deckId } : {}),
      },
      select: {
        dueDate: true,
        deckId: true,
        deck: { select: { title: true } },
      },
    })

    const reviewLogsPromise = prisma.reviewLog.findMany({
      where: {
        reviewedAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        ...(deckId ? { card: { deckId } } : {}),
      },
      select: {
        reviewedAt: true,
        rating: true,
      },
    })

    const sevenDaysFromNow = new Date(todayStart)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const todayCountsPromise = Promise.all([
      prisma.card.count({
        where: {
          dueDate: { lte: now },
          ...(deckId ? { deckId } : {}),
        },
      }),
      prisma.reviewLog.count({
        where: {
          reviewedAt: { gte: todayStart },
          ...(deckId ? { card: { deckId } } : {}),
        },
      }),
      prisma.card.count({
        where: {
          dueDate: { lte: sevenDaysFromNow },
          ...(deckId ? { deckId } : {}),
        },
      }),
      prisma.card.count({
        where: {
          dueDate: { lte: rangeEnd },
          ...(deckId ? { deckId } : {}),
        },
      })
    ])

    const [cards, reviewLogs, [dueCount, reviewedToday, dueThisWeek, dueThisMonth]] = await Promise.all([
      cardsPromise,
      reviewLogsPromise,
      todayCountsPromise,
    ])

    const futureMap = new Map<string, { date: string; count: number; deckBreakdown: Map<string, DeckBreakdown> }>()

    for (const card of cards) {
      const dueDate = new Date(card.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate < todayStart) continue

      const dateKey = formatDateLocal(dueDate)
      let dayEntry = futureMap.get(dateKey)
      if (!dayEntry) {
        dayEntry = { date: dateKey, count: 0, deckBreakdown: new Map() }
        futureMap.set(dateKey, dayEntry)
      }

      dayEntry.count += 1

      const deckTitle = card.deck?.title || 'Untitled deck'
      const deckEntry = dayEntry.deckBreakdown.get(card.deckId)
      if (deckEntry) {
        deckEntry.count += 1
      } else {
        dayEntry.deckBreakdown.set(card.deckId, {
          deckId: card.deckId,
          deckTitle,
          count: 1,
        })
      }
    }

    const futureDays: FutureDay[] = Array.from(futureMap.values())
      .map((entry) => ({
        date: entry.date,
        count: entry.count,
        deckBreakdown: Array.from(entry.deckBreakdown.values()),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const pastMap = new Map<string, PastDay>()

    for (const log of reviewLogs) {
      const reviewedDate = new Date(log.reviewedAt)
      reviewedDate.setHours(0, 0, 0, 0)
      if (reviewedDate >= todayStart) continue

      const dateKey = formatDateLocal(reviewedDate)
      let dayEntry = pastMap.get(dateKey)
      if (!dayEntry) {
        dayEntry = { date: dateKey, reviewed: 0, correct: 0 }
        pastMap.set(dateKey, dayEntry)
      }

      dayEntry.reviewed += 1
      if (log.rating >= 2) dayEntry.correct += 1
    }

    const pastDays: PastDay[] = Array.from(pastMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))

    const todayStats = {
      date: formatDateLocal(todayStart),
      dueCount,
      reviewedToday,
    }

    return NextResponse.json({ futureDays, pastDays, todayStats: { ...todayStats, dueThisWeek, dueThisMonth } })
  } catch (error) {
    console.error('[calendar] error:', error)
    return NextResponse.json({ error: 'Failed to load calendar data' }, { status: 500 })
  }
}
