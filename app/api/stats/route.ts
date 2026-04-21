
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStreak } from '@/lib/streak'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deckId = searchParams.get('deckId')

  if (!deckId)
    return NextResponse.json({ error: 'deckId is required' }, { status: 400 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const now = new Date()

  // All DB queries run in parallel — no sequential waterfall
  //
  // Mastered / Shaky / New definitions:
  //   Mastered: repetitions >= 2 AND easeFactor >= 2.0
  //     → The student has successfully recalled this card at least twice in a row
  //       and maintained a healthy ease factor. This is the "I know this" threshold.
  //
  //   Shaky: repetitions >= 1 but NOT mastered
  //     → The student has seen it before and passed at least once, but hasn't
  //       built enough consistency yet. Could go either way.
  //
  //   New: repetitions === 0
  //     → Never successfully reviewed. Either brand new or was rated "Again"
  //       which resets repetitions to 0.
  const [mastered, shaky, newCards, dueToday, total, deck, recentReviews] = await Promise.all([
    prisma.card.count({
      where: { deckId, repetitions: { gte: 2 }, easeFactor: { gte: 2.0 } },
    }),
    prisma.card.count({
      where: {
        deckId,
        repetitions: { gte: 1 },
        NOT: { AND: [{ repetitions: { gte: 2 } }, { easeFactor: { gte: 2.0 } }] },
      },
    }),
    prisma.card.count({ where: { deckId, repetitions: 0 } }),
    prisma.card.count({ where: { deckId, dueDate: { lte: now } } }),
    prisma.card.count({ where: { deckId } }),
    prisma.deck.findUnique({
      where: { id: deckId },
      select: { lastStudied: true, createdAt: true, title: true },
    }),
    prisma.reviewLog.findMany({
      where: { card: { deckId }, reviewedAt: { gte: thirtyDaysAgo } },
      select: { rating: true, reviewedAt: true },
    }),
  ])

  const retentionRate =
    recentReviews.length > 0
      ? parseFloat(
          (recentReviews.filter((r: typeof recentReviews[number]) => r.rating >= 2).length / recentReviews.length).toFixed(2)
        )
      : 0

  const streak = calculateStreak(recentReviews.map((r: typeof recentReviews[number]) => r.reviewedAt))
  const masteryPercent = total > 0 ? Math.round((mastered / total) * 100) : 0

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const reviewedToday = recentReviews.filter((r: typeof recentReviews[number]) => new Date(r.reviewedAt) >= startOfToday).length

  return NextResponse.json({
    deckId, mastered, shaky, newCards, dueToday, total, reviewedToday,
    masteryPercent, retentionRate, streak,
    lastStudied: deck?.lastStudied ?? null,
    createdAt: deck?.createdAt ?? null,
  })
}
