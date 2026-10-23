// Trend radar: what is rising across everything Briefly collected, this week against last week.
// Counted from the stories themselves (keyword matching), so it works with or without the AI.
import { interests } from './config.js'
import { terms } from './dedup.js'

// words too common in AI news to say anything about a trend
const GENERIC = new Set(('ai model models llm llms language large learning data new using via based approach method methods results ' +
  'paper show hn ask system systems towards toward framework study analysis open source release released version agents agent ' +
  'neural deep network networks training trained benchmark efficient efficiency performance improving improved multi task tasks ' +
  'generation generative reasoning evaluation human tool tools app apps code github arxiv one two first can how why what your ' +
  'year years day days week time now just more most best free still get make made want need like does doesn every all ' +
  'without after before about over into than then them they this that these those with from have has had been will would ' +
  'could should may might also only very much many some such other another here there when where which while out off back').split(' '))

const dayKey = (t, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
const textOf = (e) => ` ${e.title} ${e.text || ''} `.toLowerCase()

export function computeTrends(events, { now = Date.now(), tz = 'UTC', profile = {} } = {}) {
  const week = 7 * 864e5
  const list = Object.values(events).filter((e) => e.firstSeen)
  const thisWeek = list.filter((e) => now - Date.parse(e.firstSeen) < week)
  const lastWeek = list.filter((e) => { const age = now - Date.parse(e.firstSeen); return age >= week && age < 2 * week })

  // stories per day, last 14 days (in the user's time zone), oldest first
  const days = Array.from({ length: 14 }, (_, i) => dayKey(now - (13 - i) * 864e5, tz))
  const perDay = Object.fromEntries(days.map((d) => [d, 0]))
  for (const e of list) { const d = dayKey(Date.parse(e.firstSeen), tz); if (d in perDay) perDay[d]++ }

  const compare = (groups, mine) => groups.map((g) => {
    const hit = (e) => g.keywords.some((k) => textOf(e).includes(k))
    const now7 = thisWeek.filter(hit).length, prev7 = lastWeek.filter(hit).length
    return { id: g.id, label: g.label, thisWeek: now7, lastWeek: prev7, change: now7 - prev7, yours: mine.includes(g.id) }
  }).filter((r) => r.thisWeek || r.lastWeek).sort((a, b) => b.thisWeek - a.thisWeek || b.change - a.change)

  const counts = (set) => {
    const c = {}
    for (const e of set) for (const t of terms(e.title)) if (t.length > 2 && !GENERIC.has(t) && !/^[\d.+-]+$/.test(t)) c[t] = (c[t] || 0) + 1
    return c
  }
  const nowTerms = counts(thisWeek), prevTerms = counts(lastWeek)
  const rising = Object.entries(nowTerms)
    .map(([term, n]) => ({ term, thisWeek: n, lastWeek: prevTerms[term] || 0, change: n - (prevTerms[term] || 0) }))
    .filter((r) => r.thisWeek >= 2 && r.change > 0)
    .sort((a, b) => b.change - a.change || b.thisWeek - a.thisWeek)
    .slice(0, 12)

  return {
    totals: { thisWeek: thisWeek.length, lastWeek: lastWeek.length },
    daily: days.map((d) => ({ day: d, stories: perDay[d] })),
    topics: compare(interests.tags, profile.tags || []),
    companies: compare(interests.companies, profile.companies || []).slice(0, 10),
    rising
  }
}
