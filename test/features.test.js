import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed } from '../src/sources/blogs.js'
import { learn, learnedScore, mutedBy } from '../src/learning.js'
import { inQuietHours } from '../src/schedule.js'
// ask.js builds the viaSocket client on import; these tests make no calls, so placeholders do
process.env.BRIEFLY_DB ||= ':memory:'; process.env.VIASOCKET_ORG_ID ||= 'test'; process.env.VIASOCKET_PROJECT_ID ||= 'test'; process.env.VIASOCKET_EMBED_SECRET ||= 'test'
const { retrieve } = await import('../src/ask.js')

const feed = { id: 'openai', label: 'OpenAI', company: 'openai' }

test('company blogs: RSS and Atom feeds both parse, keeping title, link, date and a short excerpt', () => {
  const rss = `<rss><channel><item><title><![CDATA[Introducing GPT-6 &amp; more]]></title><link>https://openai.com/index/gpt-6/</link>
    <description><![CDATA[<p>Our <b>newest</b> model.</p>]]></description><pubDate>Thu, 22 Oct 2026 17:00:00 GMT</pubDate></item></channel></rss>`
  const [a] = parseFeed(rss, feed)
  assert.equal(a.title, 'Introducing GPT-6 & more')
  assert.equal(a.url, 'https://openai.com/index/gpt-6/')
  assert.equal(a.publishedAt, '2026-10-22T17:00:00.000Z')
  assert.equal(a.text, 'Official OpenAI announcement. Our newest model.')
  assert.equal(a.source, 'blogs')
  const atom = `<feed><entry><title>Gemini 4</title><link rel="alternate" href="https://deepmind.google/blog/gemini-4"/>
    <updated>2026-10-21T09:00:00Z</updated><summary>A new family.</summary></entry></feed>`
  const [b] = parseFeed(atom, { id: 'deepmind', label: 'Google DeepMind', company: 'google' })
  assert.equal(b.url, 'https://deepmind.google/blog/gemini-4')
  assert.equal(b.title, 'Gemini 4')
})

test('mute words match whole words in any case', () => {
  const ev = { title: 'Crypto exchange adds an AI agent', text: '' }
  assert.equal(mutedBy(ev, ['crypto']), 'crypto')
  assert.equal(mutedBy(ev, ['agen']), null) // part of a word does not count
  assert.equal(mutedBy({ title: 'New LLM benchmark', text: '' }, ['crypto']), null)
})

test('👍 / 👎 teach Briefly: similar stories move up or down', () => {
  const events = { a: { title: 'vLLM speculative decoding release' }, b: { title: 'Celebrity chatbot drama' } }
  const seen = { a: { vote: 1, votedAt: '2026-10-22T10:00:00Z', ai: { headline: 'vLLM gets faster decoding' } }, b: { vote: -1, votedAt: '2026-10-22T11:00:00Z', ai: { headline: 'Chatbot drama' } } }
  const user = {}
  const learned = learn(user, seen, events)
  assert.equal(learned.votes, 2)
  assert.deepEqual(learned.liked, ['vLLM gets faster decoding'])
  assert.ok(learnedScore({ title: 'Speculative decoding in vLLM 0.33' }, learned) > 0)
  assert.ok(learnedScore({ title: 'Another celebrity chatbot story' }, learned) < 0)
  assert.equal(learnedScore({ title: 'Unrelated robotics paper' }, learned), 0)
})

test("quiet hours, including a window across midnight, in the user's time zone", () => {
  const p = { timezone: 'Asia/Kolkata', quietHours: { enabled: true, start: '22:00', end: '08:00' } }
  assert.equal(inQuietHours(p, new Date('2026-10-22T17:00:00Z')), true) // 22:30 IST
  assert.equal(inQuietHours(p, new Date('2026-10-22T01:00:00Z')), true) // 06:30 IST
  assert.equal(inQuietHours(p, new Date('2026-10-22T03:00:00Z')), false) // 08:30 IST
  assert.equal(inQuietHours({ ...p, quietHours: { ...p.quietHours, enabled: false } }, new Date('2026-10-22T17:00:00Z')), false)
})

test('Ask Briefly finds the stories related to a question, newest relevant first', () => {
  const now = Date.parse('2026-10-23T00:00:00Z')
  const ev = (id, title, text = '', days = 1) => ({ id, title, text, sources: ['hackernews'], firstSeen: new Date(now - days * 864e5).toISOString() })
  const events = { a: ev('a', 'Anthropic releases Claude Duet'), b: ev('b', 'vLLM 0.32 released'), c: ev('c', 'Old Anthropic news', '', 45), d: ev('d', 'Paper on agents', 'mentions anthropic once') }
  const hits = retrieve('What did Anthropic release?', events, {}, now).map((h) => h.e.id)
  assert.deepEqual(hits, ['a']) // a title match counts; one stray word in the text (d) does not; 45-day-old story is out of range
  assert.deepEqual(retrieve('agents paper from anthropic', events, {}, now).map((h) => h.e.id)[0], 'd')
  assert.deepEqual(retrieve('the and of', events, {}, now), [])
})

test('without the AI, a story still gets a score, its original headline and a clean excerpt', async () => {
  const { fallbackAssessment } = await import('../src/relevance.js')
  const event = { id: 'ev1', title: 'Show HN: A tiny agent framework', sources: ['hackernews'] }
  const long = 'Agents ' + 'that plan and act '.repeat(30) + 'well. Second sentence.'
  const a = fallbackAssessment(event, { score: 2, matched: ['agents'] }, [{ text: long, signal: { points: 120 } }])
  assert.equal(a.headline, 'Show HN: A tiny agent framework')
  assert.equal(a.topic, 'AI agents')
  assert.equal(a.major, false)
  assert.ok(a.summary.endsWith('…') && a.summary.length <= 241 && !/\s…$/.test(a.summary))
  assert.equal(fallbackAssessment(event, { score: 1, matched: [] }, []).summary, 'New on Hacker News.')
})

test('trend radar: daily counts, topics and companies week over week, rising words', async () => {
  const { computeTrends } = await import('../src/trends.js')
  const now = Date.parse('2026-10-23T12:00:00Z')
  const ev = (id, title, daysAgo) => [id, { id, title, text: '', firstSeen: new Date(now - daysAgo * 864e5).toISOString() }]
  const events = Object.fromEntries([
    ev('a', 'Anthropic ships a new robot arm demo', 1), ev('b', 'Robot arm benchmark for humanoid tasks', 2), ev('c', 'Humanoid robot walks', 3),
    ev('d', 'OpenAI pricing update', 9), ev('e', 'Robot vacuum news', 10)
  ])
  const t = computeTrends(events, { now, tz: 'UTC', profile: { tags: ['robotics'] } })
  assert.deepEqual(t.totals, { thisWeek: 3, lastWeek: 2 })
  assert.equal(t.daily.length, 14)
  assert.equal(t.daily.reduce((s, d) => s + d.stories, 0), 5)
  const robotics = t.topics.find((x) => x.id === 'robotics')
  assert.deepEqual([robotics.thisWeek, robotics.lastWeek, robotics.yours], [3, 1, true])
  assert.equal(t.companies.find((x) => x.id === 'openai').change, -1)
  assert.deepEqual(t.rising.map((r) => r.term).slice(0, 3), ['robot', 'arm', 'humanoid']) // equal rise: more mentions first; 'vacuum' fell
})

test('one-click save: a story becomes one Google Sheets row, passed as JSON', async () => {
  const { inputFor, actionById } = await import('../src/actions.js')
  const input = inputFor(actionById('sheets'), { spreadSheet_Id: 'S1', sheet_id: 'T1' }, { title: 'Raw', url: 'https://x.dev/a', sources: ['hackernews', 'github'] }, { headline: 'Clear headline', topic: 'AI agents', summary: 'What happened.' })
  assert.deepEqual(Object.keys(input), ['spreadSheet_Id', 'sheet_id', 'use_json_rows', 'rows_json'])
  assert.equal(input.use_json_rows, true)
  const [row] = JSON.parse(input.rows_json)
  assert.deepEqual(Object.keys(row), ['Date', 'Headline', 'Topic', 'Summary', 'Link', 'Source'])
  assert.equal(row.Headline, 'Clear headline')
  assert.equal(row.Source, 'hackernews, github')
})

test('GitHub releases feed (used when the API is refused): newest stable release, notes as text', async () => {
  const { poll } = await import('../src/sources/github.js')
  const atom = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><id>tag:github.com,2008:Repository/1/v0.41.0-rc1</id><updated>2026-10-22T09:00:00Z</updated>
      <link rel="alternate" type="text/html" href="https://github.com/ollama/ollama/releases/tag/v0.41.0-rc1"/><title>v0.41.0-rc1</title><content type="html">&lt;p&gt;pre&lt;/p&gt;</content></entry>
    <entry><id>tag:github.com,2008:Repository/1/v0.40.8</id><updated>2026-10-21T14:45:50Z</updated>
      <link rel="alternate" type="text/html" href="https://github.com/ollama/ollama/releases/tag/v0.40.8"/><title>v0.40.8</title>
      <content type="html">&lt;h2&gt;What&amp;#39;s Changed&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Faster model loading&lt;/li&gt;&lt;/ul&gt;</content></entry></feed>`
  const real = globalThis.fetch
  globalThis.fetch = async (url) => String(url).includes('api.github.com')
    ? { ok: false, status: 403 } // the API refuses, as on a shared server over its quota
    : { ok: true, status: 200, text: async () => atom }
  try {
    const [item, ...rest] = await poll({ repos: ['ollama/ollama'], includePrereleases: false })
    assert.equal(rest.length, 0)
    assert.equal(item.title, 'ollama 0.40.8 released')
    assert.equal(item.url, 'https://github.com/ollama/ollama/releases/tag/v0.40.8')
    assert.equal(item.publishedAt, '2026-10-21T14:45:50Z')
    assert.match(item.text, /What's Changed Faster model loading/)
    assert.equal(item.signal.via, 'atom')
  } finally { globalThis.fetch = real }
})

test('weekly analysis: ISO week keys, and a long analysis keeps every Discord message under 2000 characters', async () => {
  const { weekKey } = await import('../src/analysis.js')
  assert.equal(weekKey(Date.parse('2026-10-23T10:00:00Z')), '2026-W43')
  assert.equal(weekKey(Date.parse('2026-01-01T10:00:00Z')), '2026-W01')
  assert.equal(weekKey(Date.parse('2027-01-01T10:00:00Z')), '2026-W53')
  const { digestMessage } = await import('../src/format.js')
  const long = 'x'.repeat(600)
  const analysis = { title: 'A week of agents', overview: long, trends: [1, 2, 3].map((n) => ({ name: `Trend ${n}`, what_changed: long, why_it_matters: 'Because.', sources: [{ n, url: `https://x.dev/${n}` }] })), watch: ['GPT-6', 'vLLM 0.33'] }
  const entries = [1, 2].map((i) => ({ event: { id: `e${i}`, url: `https://x/${i}`, sources: ['github'] }, ai: { relevance: 80, topic: 'LLMs', headline: `Story ${i}`, summary: 'S', why_it_matters: 'W', concept: '' } }))
  const parts = digestMessage(entries, 'discord', 'weekly', 6, analysis)
  for (const p of parts) assert.ok(p.body.length <= 2000, `${p.body.length}`)
  const all = parts.map((p) => p.body).join('\n')
  assert.ok(all.includes('A week of agents') && all.includes('Watch next week') && all.includes('1. Story'))
  assert.ok(all.indexOf('A week of agents') < all.indexOf('1. Story')) // the analysis opens the roundup
})
