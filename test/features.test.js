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
