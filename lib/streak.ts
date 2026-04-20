// Returns the number of consecutive calendar days (ending today or yesterday)
// on which at least one flashcard review was completed.
// Returns 0 if no reviews exist or if the last review was more than 1 day ago.
export function calculateStreak(reviewDates: Date[]): number {
  if (reviewDates.length === 0) return 0

  // Normalize all dates to midnight and deduplicate
  const days = Array.from(
    new Set(
      reviewDates.map(d => {
        const date = new Date(d)
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
    )
  ).sort((a, b) => b - a) // descending

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const yesterdayMs = todayMs - 86400000

  // Streak must touch today or yesterday to be active
  if (days[0] !== todayMs && days[0] !== yesterdayMs) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 86400000) {
      streak++
    } else {
      break
    }
  }

  return streak
}