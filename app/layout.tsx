import Link from 'next/link'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Flashcard Engine',
  description: 'Turn any PDF into a smart study deck using spaced repetition',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
            <Link
              href="/"
              className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors"
            >
              Flashcard Engine
            </Link>
            <Link
              href="/decks"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              My Decks
            </Link>
          </div>
        </nav>
        <main className="pt-14 min-h-screen max-w-5xl mx-auto px-4 sm:px-6">
          {children}
        </main>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', fontSize: '14px' },
          }}
        />
      </body>
    </html>
  )
}
