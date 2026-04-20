
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deckId = searchParams.get('deckId')
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

  if (!deckId)
    return NextResponse.json({ error: 'deckId is required' }, { status: 400 })

  // Use DB-level filtering — never fetch all cards then filter in JS
  const [cards, totalDue] = await Promise.all([
    prisma.card.findMany({
      where: { deckId, dueDate: { lte: new Date() } },
      orderBy: { dueDate: 'asc' },
      take: limit,
    }),
    prisma.card.count({
      where: { deckId, dueDate: { lte: new Date() } },
    }),
  ])

  return NextResponse.json({ cards, totalDue, hasMore: totalDue > limit })
}
