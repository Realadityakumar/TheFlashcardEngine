'use client'

import Link from 'next/link'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel: string
  actionHref: string
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="py-20 text-center">
      <span className="text-6xl">📚</span>
      <h2 className="text-2xl font-semibold mt-4 text-gray-800">{title}</h2>
      <p className="text-gray-500 mt-2">{description}</p>
      <Link
        href={actionHref}
        className="mt-6 inline-block bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors font-medium"
      >
        {actionLabel}
      </Link>
    </div>
  )
}
