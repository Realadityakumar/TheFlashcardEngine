import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-6xl">🤔</p>
      <h1 className="text-2xl font-bold mt-4 text-gray-800">Page not found</h1>
      <p className="text-gray-500 mt-2">
        This page doesn&apos;t exist or was moved.
      </p>
      <Link href="/" className="mt-6 text-blue-500 hover:underline">
        ← Back to home
      </Link>
    </div>
  )
}
