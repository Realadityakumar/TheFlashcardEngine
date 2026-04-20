import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'
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
        <Navbar />
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
