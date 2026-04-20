export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateSM2 } from '@/lib/sm2'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId, rating } = body

    if (!cardId || typeof cardId !== 'string')
      return NextResponse.json({ error: 'cardId is required' }, { status: 400 })

    if (![0, 1, 2, 3].includes(rating))
      return NextResponse.json({ error: 'rating must be 0, 1, 2, or 3' }, { status: 400 })

    const card = await prisma.card.findUnique({ where: { id: cardId } })
    if (!card)
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    const result = calculateSM2({
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      rating,
    })

    // Atomic transaction: update card + log review + update deck lastStudied
    const [updatedCard] = await prisma.$transaction([
      prisma.card.update({
        where: { id: cardId },
        data: {
          easeFactor: result.easeFactor,
          interval: result.interval,
          repetitions: result.repetitions,
          dueDate: result.dueDate,
        },
      }),
      prisma.reviewLog.create({
        data: { cardId, rating },
      }),
      prisma.deck.update({
        where: { id: card.deckId },
        data: { lastStudied: new Date() },
      }),
    ])

    return NextResponse.json({ card: updatedCard, nextDue: result.dueDate })

  } catch (error) {
    console.error('[review] error:', error)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }
}