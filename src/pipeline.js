// Poll → dedup → relevance → summary → instant delivery or digest queue.
import { load, save, prune, userEvents } from './store.js'
import { sources, engine } from './config.js'
import { pollers } from './sources/index.js'
import { cluster } from './dedup.js'
import { keywordScore, assess, fallbackAssessment } from './relevance.js'
import { send } from './delivery.js'
import { instantMessage, digestMessage } from './format.js'
import { channelById } from './config.js'
import { digestDue, inQuietHours } from './schedule.js'
import { mutedBy } from './learning.js'
import { recordSent } from './replies.js'
import { weeklyAnalysis } from './analysis.js'

const log = (...a) => console.log(new Date().toISOString(), ...a)

export async function pollSources() {
  const db = load()
  const fresh = []
  for (const [name, cfg] of Object.entries(sources)) {
    if (!cfg.enabled || !pollers[name]) continue
    try {
      const maxAge = Date.now() - engine.maxItemAgeDays * 864e5
      const items = (await pollers[name].poll(cfg)).filter((i) => !i.publishedAt || Date.parse(i.publishedAt) >= maxAge)
      const newOnes = items.filter((i) => !db.items[i.id])
      for (const i of newOnes) db.items[i.id] = { ...i, fetchedAt: new Date().toISOString() }
      fresh.push(...newOnes.map((i) => db.items[i.id]))
      db.sourceStatus[name] = { ok: true, at: new Date().toISOString(), fetched: items.length, new: newOnes.length }
      log(`[poll] ${name}: ${items.length} items, ${newOnes.length} new`)
    } catch (error) {
      db.sourceStatus[name] = { ok: false, at: new Date().toISOString(), error: error.message.slice(0, 300) }
      log(`[poll] ${name} failed: ${error.message}`)
    }
  }
  // Dedup first, so relevance and delivery only ever see one event per real-world happening.
  const created = cluster(fresh, db.events, { windowDays: engine.dedupWindowDays, threshold: engine.dedupSimilarity })
  save()
  prune()
  log(`[dedup] ${fresh.length} new items → ${created.length} new events`)
  return { newItems: fresh.length, newEvents: created }
}

/** skip, digest or instant, from the AI's assessment and the user's frequency. */
export function decide(ai, profile) {
  if (ai.relevance < engine.minRelevance) return 'skip'
  const bar = profile.frequency === 'instant' ? engine.instantRelevanceMajorOnlyMode : engine.instantRelevance
  return ai.major && ai.relevance >= bar ? 'instant' : 'digest'
}

/** Scores the events this user has not seen yet; instant ones are delivered, the rest queued for the digest. */
export async function processUser(user, { since } = {}) {
  const db = load()
  const seen = userEvents(user.id)
  const sinceMs = Date.parse(since || user.createdAt) - engine.dedupWindowDays * 864e5
  const pending = Object.values(db.events).filter((e) => !seen[e.id] && Date.parse(e.firstSeen) >= sinceMs)
  const muteWords = user.profile.muteWords || []
  const unmuted = pending.filter((e) => {
    const word = mutedBy(e, muteWords)
    if (word) seen[e.id] = { status: 'skipped', reason: `muted: ${word}`, at: new Date().toISOString() }
    return !word
  })
  // watchlist words: a story that mentions one always goes through, first in line, and is sent right away
  const watched = Object.fromEntries(unmuted.map((e) => [e.id, mutedBy(e, user.profile.watch || [])]).filter(([, w]) => w))
  const scored = unmuted.map((e) => ({ e, k: keywordScore(e, user.profile, user.learned) }))
  for (const { e, k } of scored) if (k.score === 0 && !watched[e.id]) seen[e.id] = { status: 'skipped', reason: 'no interest matched', at: new Date().toISOString() }
  const candidates = scored.filter((s) => s.k.score > 0 || watched[s.e.id])
    .sort((a, b) => !!watched[b.e.id] - !!watched[a.e.id] || b.k.score - a.k.score).slice(0, engine.maxCandidatesPerRun)
  if (!candidates.length) { save(); return { assessed: 0, instant: 0, queued: 0 } }

  let results = {}
  let fallback = false
  try {
    results = await assess(user.id, user.profile, candidates.map((c) => c.e), db.items, user.learned)
  } catch (error) {
    // no AI right now (credits used up, outage): keep delivering with keyword ranking and original headlines
    fallback = true
    log(`[relevance] ${user.id}: AI unavailable (${error.message}); using keyword ranking`)
  }
  let instant = 0, queued = 0
  for (const { e, k } of candidates) {
    const ai = results[e.id] || (fallback ? fallbackAssessment(e, k, e.itemIds.map((id) => db.items[id]).filter(Boolean)) : null)
    if (!ai) continue // left for the next run, never dropped
    if (watched[e.id]) ai.watch = watched[e.id]
    const record = { ai, at: new Date().toISOString() }
    const mode = watched[e.id] ? 'instant' : decide(ai, user.profile)
    if (mode === 'skip') { seen[e.id] = { ...record, status: 'skipped', reason: 'low relevance' }; continue }
    seen[e.id] = { ...record, status: 'queued', mode }
    mode === 'instant' ? instant++ : queued++
  }
  save()
  log(`[relevance] ${user.id}: ${candidates.length} assessed${fallback ? ' without AI' : ''}, ${instant} instant, ${queued} for the digest`)
  await deliverInstant(user)
  return { assessed: candidates.length, instant, queued }
}

function record(user, kind, eventIds, ok, detail) {
  const db = load()
  db.deliveries.unshift({ userId: user.id, kind, channel: user.delivery?.channel, eventIds, ok, detail, at: new Date().toISOString() })
  db.deliveries = db.deliveries.slice(0, 500)
}

export async function deliverInstant(user) {
  const db = load()
  const seen = userEvents(user.id)
  const channel = channelById(user.delivery?.channel)
  if (!channel || !user.delivery?.ready) return 0
  if (inQuietHours(user.profile)) return 0 // they wait, and go out when quiet hours end
  let sent = 0
  for (const [id, s] of Object.entries(seen)) {
    if (s.status !== 'queued' || s.mode !== 'instant') continue
    const entry = { event: db.events[id], ai: s.ai }
    try {
      recordSent(user, await send(user, [instantMessage(entry, channel.format)], { important: true }), [id])
      Object.assign(s, { status: 'sent', sentAt: new Date().toISOString() })
      record(user, 'instant', [id], true)
      sent++
    } catch (error) {
      // It moves to the digest rather than disappearing.
      Object.assign(s, { mode: 'digest', lastError: error.message })
      record(user, 'instant', [id], false, error.message)
    }
    save()
  }
  return sent
}

/** Sends everything waiting for the digest. `slot` (from digestDue) marks that slot as done, even when empty. */
export async function deliverDigest(user, period, slot) {
  const db = load()
  const seen = userEvents(user.id)
  const channel = channelById(user.delivery?.channel)
  if (!channel || !user.delivery?.ready) return { sent: 0 }
  const ids = Object.entries(seen).filter(([, s]) => s.status === 'queued' && s.mode === 'digest').map(([id]) => id)
  if (!ids.length) {
    if (slot) { user.lastDigestKey = slot; save() }
    return { sent: 0 }
  }
  const entries = ids.map((id) => ({ event: db.events[id], ai: seen[id].ai }))
  try {
    // a weekly roundup opens with the AI's analysis of the week (left out if the AI is unavailable)
    const analysis = period === 'weekly' ? await weeklyAnalysis(user).then((a) => (a.empty ? null : a)).catch(() => null) : null
    const parts = digestMessage(entries, channel.format, period, undefined, analysis)
    const result = await send(user, parts)
    recordSent(user, result, parts.ids) // so a reply can say "explain 3"
    for (const id of ids) Object.assign(seen[id], { status: 'sent', sentAt: new Date().toISOString() })
    record(user, `${period} digest`, ids, true)
    user.lastDigestAt = new Date().toISOString()
    if (slot) user.lastDigestKey = slot
    save()
    return { sent: ids.length, result }
  } catch (error) {
    record(user, `${period} digest`, ids, false, error.message)
    save()
    throw error
  }
}

export { digestDue } from './schedule.js'

export async function runCycle() {
  await pollSources()
  for (const user of Object.values(load().users)) {
    if (!user.onboarded) continue
    try { await processUser(user) } catch (error) { log(`[relevance] ${user.id} failed: ${error.message}`) }
  }
}

export async function runDigests() {
  for (const user of Object.values(load().users)) {
    if (!user.onboarded) continue
    // instant alerts held back by quiet hours go out once they end
    try { await deliverInstant(user) } catch (error) { log(`[instant] ${user.id} failed: ${error.message}`) }
    const due = digestDue(user)
    if (!due) continue
    try { await deliverDigest(user, due.period, due.key) } catch (error) { log(`[digest] ${user.id} failed: ${error.message}`) }
  }
}
