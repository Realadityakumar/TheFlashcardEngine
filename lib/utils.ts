// Shared utility helpers

export function relativeDate(ds: string | null): string {
  if (!ds) return 'Never studied'

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const then = new Date(ds)
  then.setHours(0, 0, 0, 0)
  
  const diffMs = then.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays === 0) return 'Today'
  
  if (diffDays > 0) {
    // Future dates
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return `in ${diffDays} days`
    if (diffDays < 30) return `in ${Math.round(diffDays / 7)} weeks`
    if (diffDays < 365) return `in ${Math.round(diffDays / 30)} months`
    return `in ${Math.round(diffDays / 365)} years`
  } else {
    // Past dates
    const pastDays = Math.abs(diffDays)
    if (pastDays === 1) return 'Yesterday'
    if (pastDays < 7) return `${pastDays} days ago`
    if (pastDays < 30) return `${Math.round(pastDays / 7)} weeks ago`
    if (pastDays < 365) return `${Math.round(pastDays / 30)} months ago`
    return `${Math.round(pastDays / 365)} years ago`
  }
}
