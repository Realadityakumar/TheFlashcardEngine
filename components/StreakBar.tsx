'use client'

interface StreakBarProps {
  pastDays: { date: string; reviewed: number; correct: number }[]
  todayReviewed: number
  currentStreak: number
  longestStreak: number
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getSquareColor(reviewed: number): string {
  if (reviewed >= 16) return '#6c63ff'
  if (reviewed >= 6) return 'rgba(108,99,255,0.6)'
  if (reviewed >= 1) return 'rgba(108,99,255,0.3)'
  return '#161625'
}

export default function StreakBar({
  pastDays,
  todayReviewed,
  currentStreak,
  longestStreak,
}: StreakBarProps) {
  const lookup = new Map(pastDays.map((day) => [day.date, day.reviewed]))
  const today = new Date()
  const todayKey = formatDateLocal(today)

  const squares = Array.from({ length: 30 }, (_, idx) => {
    const date = new Date()
    date.setDate(today.getDate() - (29 - idx))
    const key = formatDateLocal(date)
    const reviewed = key === todayKey ? todayReviewed : lookup.get(key) || 0
    const isToday = key === todayKey
    return { key, reviewed, isToday, color: getSquareColor(reviewed) }
  })

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#4a4a6a] uppercase tracking-widest">Study Activity</span>
        <span className="text-xs text-[#8888aa] font-mono">
          {currentStreak} day streak 🔥 · Best: {longestStreak} days
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {squares.map((square) => (
          <span
            key={square.key}
            title={`${square.key}: ${square.reviewed} cards reviewed`}
            className="inline-block"
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: square.color,
              boxShadow:
                square.isToday && square.reviewed > 0
                  ? '0 0 6px rgba(108,99,255,0.5)'
                  : undefined,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2 text-[10px] text-[#4a4a6a]">
        <span>Less</span>
        <span className="inline-block" style={{ width: 10, height: 10, borderRadius: 3, background: '#161625' }} />
        <span className="inline-block" style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(108,99,255,0.3)' }} />
        <span className="inline-block" style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(108,99,255,0.6)' }} />
        <span className="inline-block" style={{ width: 10, height: 10, borderRadius: 3, background: '#6c63ff' }} />
        <span>More</span>
      </div>
    </div>
  )
}
