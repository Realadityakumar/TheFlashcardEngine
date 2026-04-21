import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import NavLinks from '@/components/NavLinks'
import './globals.css'

const syne = Syne({ 
  subsets: ['latin'], 
  weight: ['400','600','700','800'], 
  variable: '--font-display' 
})

const dmSans = DM_Sans({ 
  subsets: ['latin'], 
  weight: ['300','400','500'], 
  variable: '--font-body' 
})

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
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="antialiased font-[family-name:var(--font-body)]">
        <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-[rgba(8,8,15,0.8)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.06)]">
          <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <svg
                width="10"
                height="13"
                viewBox="0 0 10 13"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#6c63ff]"
              >
                <path d="M5.5 0L0 7H4.5L3.5 13L9.5 5.5H5L5.5 0Z" fill="currentColor" />
              </svg>
              <span className="font-[family-name:var(--font-display)] font-bold text-xl text-[#f0f0ff]">
                Flashcard<span className="text-[#6c63ff]">Engine</span>
              </span>
            </Link>

            <NavLinks />
          </div>

          <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#6c63ff40] to-transparent"></div>
        </nav>
        <main className="pt-[60px] min-h-screen max-w-[1200px] mx-auto px-4 sm:px-6">
          {children}
        </main>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#161625',
              color: '#f0f0ff',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'var(--font-body)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            },
            success: {
              iconTheme: { primary: '#00e5a0', secondary: '#0f0f1a' }
            },
            error: {
              iconTheme: { primary: '#ff4d6d', secondary: '#0f0f1a' }
            },
          }}
        />
      </body>
    </html>
  )
}
