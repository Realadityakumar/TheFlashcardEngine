'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  
  // Active if we are strictly on /decks or sub-paths like /decks/[id]
  const isActive = pathname.startsWith('/decks')

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-[rgba(8,8,15,0.8)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.06)]">
      <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
        
        {/* Left side — Logo */}
        <Link href="/" className="flex items-center gap-2">
          {/* Spark SVG */}
          <svg 
            width="10" 
            height="13" 
            viewBox="0 0 10 13" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className="text-[#6c63ff]"
          >
            <path d="M5.5 0L0 7H4.5L3.5 13L9.5 5.5H5L5.5 0Z" fill="currentColor"/>
          </svg>
          
          <span className="font-[family-name:var(--font-display)] font-bold text-xl text-[#f0f0ff]">
            Flashcard<span className="text-[#6c63ff]">Engine</span>
          </span>
        </Link>

        {/* Right side — Links */}
        <div className="flex items-center space-x-6">
          <Link 
            href="/decks" 
            className={`
              relative text-sm transition-colors duration-150 group
              ${isActive ? 'text-[#6c63ff]' : 'text-[#8888aa] hover:text-[#f0f0ff]'}
            `}
          >
            My Decks
            {/* Sliding underline */}
            <span 
              className={`
                absolute -bottom-1 left-0 w-full h-[1px] bg-current transform origin-left transition-transform duration-150
                ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}
              `}
            ></span>
          </Link>
        </div>
        
      </div>

      {/* Very subtle gradient fade at bottom spanning the entire width */}
      <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#6c63ff40] to-transparent"></div>
    </nav>
  )
}
