// SM-2: schedules flashcard reviews based on recall quality.
// Cards recalled well are shown less often; cards recalled poorly appear more often.
//
// Rating scale:
//   0 = Again  → complete failure, reset to day 1, re-show this session
//   1 = Hard   → passed but struggled, shorter next interval, NOT re-shown this session
//   2 = Good   → solid recall, normal SM-2 progression
//   3 = Easy   → effortless recall, boosted interval

export interface SM2Input {
  easeFactor: number     // starts at 2.5, floor is 1.3
  interval: number       // days until next review
  repetitions: number    // count of consecutive successful reviews
  rating: 0 | 1 | 2 | 3 // 0=Again 1=Hard 2=Good 3=Easy
}

export interface SM2Output {
  easeFactor: number
  interval: number
  repetitions: number
  dueDate: Date
}

export function calculateSM2(input: SM2Input): SM2Output {
  let { easeFactor, interval, repetitions } = input
  const { rating } = input

  // Update ease factor for every rating (formula adapted for 0-3 scale)
  // rating=3 (Easy):  EF += +0.10  (grows faster)
  // rating=2 (Good):  EF +=  0.00  (neutral)
  // rating=1 (Hard):  EF += -0.14  (grows slower)
  // rating=0 (Again): EF += -0.32  (grows much slower)
  easeFactor = easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02)
  easeFactor = Math.max(1.3, parseFloat(easeFactor.toFixed(2)))

  if (rating === 0) {
    // ── Again ─────────────────────────────────────────────────────────────
    // Complete failure — reset streak, show again tomorrow (and re-queue in session)
    repetitions = 0
    interval = 1
  } else if (rating === 1) {
    // ── Hard ──────────────────────────────────────────────────────────────
    // Passed but struggled. Keep the streak alive but use a shorter interval.
    // This is the key difference: Hard is a PASS, not a failure.
    // The card is NOT re-shown this session — it just comes back sooner than Good.
    if (repetitions === 0) {
      interval = 1        // first time seeing it → come back tomorrow
    } else if (repetitions === 1) {
      interval = 3         // instead of 6 days (Good), come back in 3
    } else {
      // Multiply by a reduced factor (1.2× instead of full easeFactor)
      interval = Math.max(2, Math.round(interval * 1.2))
    }
    repetitions += 1
  } else if (rating === 2) {
    // ── Good ──────────────────────────────────────────────────────────────
    // Solid recall — standard SM-2 progression
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  } else {
    // ── Easy (3) ──────────────────────────────────────────────────────────
    // Effortless — boost the interval with an extra multiplier
    if (repetitions === 0) {
      interval = 4         // skip ahead: 4 days instead of 1
    } else if (repetitions === 1) {
      interval = 10        // skip ahead: 10 days instead of 6
    } else {
      interval = Math.round(interval * easeFactor * 1.3) // 30% bonus
    }
    repetitions += 1
  }

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + interval)
  dueDate.setHours(0, 0, 0, 0)

  return { easeFactor, interval, repetitions, dueDate }
}

// Returns what the next interval WOULD be for each possible rating.
// Used by RatingButtons to show "next in X days" preview labels.
export function previewIntervals(
  input: Omit<SM2Input, 'rating'>
): Record<0 | 1 | 2 | 3, number> {
  return {
    0: calculateSM2({ ...input, rating: 0 }).interval,
    1: calculateSM2({ ...input, rating: 1 }).interval,
    2: calculateSM2({ ...input, rating: 2 }).interval,
    3: calculateSM2({ ...input, rating: 3 }).interval,
  }
}

export default calculateSM2
