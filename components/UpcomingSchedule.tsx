'use client'

import { relativeDate } from '@/lib/utils'

interface ScheduleEntry {
  date: string
  count: number
  isToday: boolean
  label: string
}

interface UpcomingScheduleProps {
  schedule: ScheduleEntry[]
  nextReviewAt: string | null
}

export function UpcomingSchedule({ schedule, nextReviewAt }: UpcomingScheduleProps) {
  if (schedule.length === 0) {
    return (
      <div className="text-center text-[#8888aa] text-sm py-4">
        No upcoming reviews scheduled
      </div>
    )
  }

  const maxCount = Math.max(...schedule.map(s => s.count))

  function formatNextReview(dateStr: string | null): string {
    if (!dateStr) return ''
    const diff = new Date(dateStr).getTime() - Date.now()
    if (diff <= 0) return 'Review now'
    
    const rel = relativeDate(dateStr)
    return rel.charAt(0).toUpperCase() + rel.slice(1)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <p className="text-xs font-medium text-[#4a4a6a] uppercase tracking-widest mb-4">
        Upcoming reviews
      </p>

      {/* Schedule rows */}
      <div className="space-y-1">
        {schedule.map((entry) => (
          <div key={entry.date} className="flex items-center gap-3 py-1">
            {/* Date label */}
            <span
              className={`text-xs w-20 shrink-0 ${
                entry.isToday ? 'text-[#6c63ff] font-semibold' : 'text-[#8888aa]'
              }`}
            >
              {entry.label}
            </span>

            {/* Bar */}
            <div className="flex-1 bg-[#161625] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(8, (entry.count / maxCount) * 100)}%`,
                  background: entry.isToday ? 'linear-gradient(90deg, #6c63ff, #00d2ff)' : '#1e1e30'
                }}
              />
            </div>

            {/* Count */}
            <span
              className={`font-[family-name:var(--font-mono)] text-xs w-6 text-right shrink-0 ${
                entry.isToday ? 'text-[#6c63ff]' : 'text-[#4a4a6a]'
              }`}
            >
              {entry.count}
            </span>
          </div>
        ))}
      </div>

      {/* Next review time */}
      {nextReviewAt && (
        <p className="text-xs text-[#4a4a6a] text-center mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
          Next review: {formatNextReview(nextReviewAt)}
        </p>
      )}
    </div>
  )
}