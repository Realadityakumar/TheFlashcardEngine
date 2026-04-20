
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deckId = searchParams.get('deckId')

  if (!deckId)
    return NextResponse.json({ error: 'deckId is required' }, { status: 400 })

  try {
    const now = new Date()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const fourteenDaysLater = new Date(Date.now() + 14 * 86400000)

    // Cards already due today (overdue + today)
    const todayDueCount = await prisma.card.count({
      where: { deckId, dueDate: { lte: now } },
    })

    // Future cards due in next 14 days (tomorrow onwards)
    const futureCards = await prisma.card.findMany({
      where: {
        deckId,
        dueDate: { gt: now, lte: fourteenDaysLater },
      },
      select: { dueDate: true },
      orderBy: { dueDate: 'asc' },
    })

    // Group future cards by calendar date
    const groups: Record<string, number> = {}
    for (const card of futureCards) {
      const dateKey = card.dueDate.toISOString().split('T')[0]
      groups[dateKey] = (groups[dateKey] || 0) + 1
    }

    // Build sorted schedule array
    const today = todayStart.toISOString().split('T')[0]

    const schedule: { date: string; count: number; isToday: boolean; label: string }[] = []

    // Add today if there are due cards
    if (todayDueCount > 0) {
      schedule.push({ date: today, count: todayDueCount, isToday: true, label: 'Today' })
    }

    // Add future dates
    const tomorrow = new Date(todayStart)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = tomorrow.toISOString().split('T')[0]

    const sortedDates = Object.keys(groups).sort()
    for (const dateKey of sortedDates) {
      const date = new Date(dateKey + 'T00:00:00')
      let label: string
      if (dateKey === tomorrowKey) {
        label = 'Tomorrow'
      } else {
        label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      }
      schedule.push({ date: dateKey, count: groups[dateKey], isToday: false, label })
    }

    // Next review time: the nearest future dueDate
    const nextCard = await prisma.card.findFirst({
      where: { deckId, dueDate: { gt: now } },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true },
    })

    return NextResponse.json({
      schedule,
      nextReviewAt: nextCard?.dueDate ?? null,
      todayDueCount,
    })

  } catch (error) {
    console.error('[schedule] error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}