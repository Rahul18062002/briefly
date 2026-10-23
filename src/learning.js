// What each user teaches Briefly with 👍 / 👎, and the words they muted.
import { terms } from './dedup.js'

const noise = (t) => t.length < 3 || /^[\d.+-]+$/.test(t) // versions and numbers say nothing about taste
export const eventTerms = (event) => [...terms(event.title || '')].filter((t) => !noise(t))

/** Rebuilds the user's learned taste from all their votes: a weight per word, plus recent liked/disliked headlines. */
export function learn(user, seen, events) {
  const weights = {}, liked = [], disliked = []
  const voted = Object.entries(seen).filter(([, s]) => s.vote).sort((a, b) => Date.parse(b[1].votedAt) - Date.parse(a[1].votedAt))
  for (const [id, s] of voted) {
    const event = events[id]
    if (!event) continue
    for (const t of eventTerms(event)) weights[t] = (weights[t] || 0) + s.vote
    const list = s.vote > 0 ? liked : disliked
    if (list.length < 6) list.push(s.ai?.headline || event.title)
  }
  for (const t of Object.keys(weights)) if (!weights[t]) delete weights[t]
  user.learned = { weights, liked, disliked, votes: voted.length }
  return user.learned
}

/** How much the user's past votes push this story up or down, between -3 and +3. */
export function learnedScore(event, learned) {
  if (!learned?.weights) return 0
  let s = 0
  for (const t of eventTerms(event)) s += learned.weights[t] || 0
  return Math.max(-3, Math.min(3, s))
}

const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The muted word this story contains, if any (whole words, any case). */
export function mutedBy(event, words = []) {
  const blob = `${event.title} ${event.text || ''}`
  return words.find((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}($|[^\\p{L}\\p{N}])`, 'iu').test(blob)) || null
}
