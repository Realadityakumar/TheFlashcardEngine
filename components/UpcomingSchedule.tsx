
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
      <div className="text-center text-gray-400 text-sm py-4">
        No upcoming reviews scheduled
      </div>
    )
  }

  // Max count drives the bar width proportions
  const maxCount = Math.max(...schedule.map(s => s.count))

  // Format the "next review in X hours" text using shared calendar utility
  function formatNextReview(dateStr: string | null): string {
    if (!dateStr) return ''
    const diff = new Date(dateStr).getTime() - Date.now()
    if (diff <= 0) return 'Review now'
    
    // Capitalize the first letter so it looks nice: "Tomorrow", "In 3 days"
    const rel = relativeDate(dateStr)
    return rel.charAt(0).toUpperCase() + rel.slice(1)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Upcoming reviews
      </p>

      {/* Schedule rows */}
      <div className="space-y-2">
        {schedule.map((entry) => (
          <div key={entry.date} className="flex items-center gap-3">
            {/* Date label */}
            <span
              className={`text-xs w-20 shrink-0 ${
                entry.isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'
              }`}
            >
              {entry.label}
            </span>

            {/* Bar */}
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  entry.isToday ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{ width: `${Math.max(8, (entry.count / maxCount) * 100)}%` }}
              />
            </div>

            {/* Count */}
            <span
              className={`text-xs w-8 text-right shrink-0 ${
                entry.isToday ? 'text-blue-600 font-semibold' : 'text-gray-400'
              }`}
            >
              {entry.count}
            </span>
          </div>
        ))}
      </div>

      {/* Next review time */}
      {nextReviewAt && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Next review: {formatNextReview(nextReviewAt)}
        </p>
      )}
    </div>
  )
}