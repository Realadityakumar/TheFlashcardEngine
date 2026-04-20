'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[rgba(255,77,109,0.25)] bg-[rgba(255,77,109,0.08)] p-6 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[#f0f0ff]">
          Something went wrong
        </h2>
        <p className="mt-3 text-sm text-[#ff9db0]">
          An unexpected error occurred. You can retry or return to the home page.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #6c63ff, #00d2ff)' }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl text-sm font-medium border border-[rgba(255,255,255,0.12)] text-[#f0f0ff]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
