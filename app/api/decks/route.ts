
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  // Single deck fetch (for detail page)
  if (id) {
    const deck = await prisma.deck.findUnique({
      where: { id },
      include: { cards: { orderBy: { dueDate: 'asc' } } },
    })
    if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ deck })
  }

  // All decks fetch (for list page) — one query, includes card count
  const decks = await prisma.deck.findMany({
    orderBy: [
      { lastStudied: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    include: { _count: { select: { cards: true } } },
  })
  return NextResponse.json({ decks })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    await prisma.deck.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  }
}