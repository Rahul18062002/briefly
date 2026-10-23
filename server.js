import './src/env.js'
import express from 'express'
import { viasocket, serviceIdFor } from './src/viasocket.js'
import { interests, delivery, engine, channelById, allowedApps, tagById, companyById } from './src/config.js'
import { load, save, getUser, putUser, userEvents } from './src/store.js'
import { ensureEnabled, options, send } from './src/delivery.js'
import { runCycle, runDigests, processUser, deliverDigest, pollSources } from './src/pipeline.js'
import { digestMessage } from './src/format.js'
import { learn } from './src/learning.js'
import { LANGUAGES } from './src/relevance.js'
import { computeTrends } from './src/trends.js'
import { ask, chatLog } from './src/ask.js'
import { COOKIE, signUp, signIn, createSession, sessionFor, endSession, changePassword, tooManyAttempts, noteFailure } from './src/auth.js'
import { WEEKDAYS, validTime, validTimeZone, scheduleText, nextDigestLabel, formatTime, DEFAULT_TIME, DEFAULT_DAY } from './src/schedule.js'

const app = express()
app.use(express.json())
app.use(express.static('public'))
app.use('/vendor/viasocket-apps', express.static('node_modules/viasocket-apps/dist/esm'))

// ---- accounts ----
app.set('trust proxy', true) // Embarko terminates HTTPS in front of the app
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]))
function setCookie(req, res, name, value, maxAge) {
  res.append('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.secure ? '; Secure' : ''}`)
}

// who is signed in; req.userId is the id every other part of the product (and viaSocket) uses for them
app.use((req, res, next) => {
  req.cookies = cookies(req)
  const session = sessionFor(req.cookies[COOKIE])
  if (session) Object.assign(req, { session, account: session.account, userId: session.account.id })
  next()
})

const authError = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong on our side. Please try again.' })
function startSession(req, res, account) {
  setCookie(req, res, COOKIE, createSession(account.id), 30 * 86400)
  setCookie(req, res, 'tp_uid', '', 0) // the pre-login browser id is no longer needed
  res.json({ account })
}
app.post('/api/auth/signup', (req, res) => {
  try { startSession(req, res, signUp(req.body || {}, req.cookies.tp_uid)) } catch (e) { authError(res, e) }
})
app.post('/api/auth/login', (req, res) => {
  const keys = [`ip:${req.ip}`, `email:${String(req.body?.email || '').toLowerCase()}`]
  if (tooManyAttempts(...keys)) return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes and try again.' })
  try { startSession(req, res, signIn(req.body || {})) } catch (e) { if (e.status === 401) noteFailure(...keys); authError(res, e) }
})
app.post('/api/auth/logout', (req, res) => {
  endSession(req.cookies[COOKIE])
  setCookie(req, res, COOKIE, '', 0)
  res.json({ ok: true })
})
app.get('/api/auth/me', (req, res) => res.json({ account: req.account || null }))
app.post('/api/auth/password', (req, res) => {
  if (!req.account) return res.status(401).json({ error: 'Please sign in.' })
  try { changePassword(req.account.id, req.body?.current, req.body?.next); res.json({ ok: true, message: 'Password changed.' }) } catch (e) { authError(res, e) }
})

// everything else needs a signed-in user (the app list is public: the sign-in page shows it)
app.use('/api', (req, res, next) => {
  if (req.path === '/catalog' || req.account) return next()
  res.status(401).json({ error: 'Please sign in.', signIn: true })
})

const FREQUENCIES = ['instant', 'daily', 'weekly']

function currentUser(req) {
  return getUser(req.userId) || {
    id: req.userId,
    createdAt: new Date().toISOString(),
    onboarded: false,
    profile: { ...interests.defaults },
    connections: {},
    delivery: { channel: null, fields: {}, ready: false }
  }
}

const iconCache = {}
async function appInfo(slug) {
  if (!iconCache[slug]) {
    const v = await viasocket.catalog.versions(await serviceIdFor(slug))
    iconCache[slug] = { slug, name: delivery.apps[slug].name, icon: v?.service.icon_url }
  }
  return iconCache[slug]
}

// ---- configuration the UI renders from (no technical settings) ----
app.get('/api/catalog', async (req, res, next) => {
  try {
    res.json({
      tags: interests.tags.map(({ id, label }) => ({ id, label })),
      companies: interests.companies.map(({ id, label }) => ({ id, label })),
      frequencies: [
        { id: 'instant', label: 'Instant for major news', blurb: 'Big launches the moment they happen. Everything else in a short daily digest.' },
        { id: 'daily', label: 'Daily digest', blurb: 'One calm summary a day, at the time you choose.' },
        { id: 'weekly', label: 'Weekly roundup', blurb: 'One roundup a week, on the day and time you choose.' }
      ],
      weekdays: WEEKDAYS,
      languages: Object.entries(LANGUAGES).map(([id, label]) => ({ id, label })),
      apps: await Promise.all(allowedApps.map(appInfo)),
      channels: delivery.channels.map(({ id, app, label, hint, pick = [], ask = [] }) => ({ id, app, label, hint, pick, ask }))
    })
  } catch (e) { next(e) }
})

app.get('/api/me', async (req, res, next) => {
  try {
    const user = currentUser(req)
    // A connection that expired is shown as "Reconnect" and is renewed in place, keeping its auth_id.
    const expired = {}
    if (Object.keys(user.connections || {}).length) {
      const live = await viasocket.user(user.id).listConnections()
      for (const [slug, c] of Object.entries(user.connections)) {
        const found = live.find((l) => l.id === c.authId)
        expired[slug] = !found || found.isExpired === true
      }
    }
    res.json({
      account: req.account,
      onboarded: user.onboarded,
      profile: { digestTime: DEFAULT_TIME, digestDay: DEFAULT_DAY, quietHours: { enabled: false, start: '22:00', end: '08:00' }, muteWords: [], watch: [], language: 'en', ...user.profile },
      learned: { votes: user.learned?.votes || 0 },
      schedule: { text: scheduleText(user.profile), next: nextDigestLabel(user.profile) },
      delivery: user.delivery,
      connections: Object.fromEntries(Object.entries(user.connections || {}).map(([slug, c]) => [slug, { connected: true, expired: expired[slug], authId: c.authId, label: c.label }]))
    })
  } catch (e) { next(e) }
})

app.post('/api/profile', (req, res) => {
  const user = currentUser(req)
  const { tags, companies, frequency, learningMode, digestTime, digestDay, timezone, quietHours, muteWords, watch, language } = req.body
  const validTags = (tags || []).filter((t) => tagById(t))
  if (!validTags.length) return res.status(400).json({ error: 'Pick at least one interest.' })
  user.profile = {
    tags: validTags,
    companies: (companies || []).filter((c) => companyById(c)),
    frequency: FREQUENCIES.includes(frequency) ? frequency : 'daily',
    digestTime: validTime(digestTime) || user.profile.digestTime || DEFAULT_TIME,
    digestDay: Number.isInteger(digestDay) && digestDay >= 0 && digestDay <= 6 ? digestDay : (user.profile.digestDay ?? DEFAULT_DAY),
    timezone: validTimeZone(timezone) ? timezone : (user.profile.timezone || 'UTC'),
    learningMode: !!learningMode,
    quietHours: quietHours && typeof quietHours === 'object'
      ? { enabled: !!quietHours.enabled, start: validTime(quietHours.start) || '22:00', end: validTime(quietHours.end) || '08:00' }
      : user.profile.quietHours || { enabled: false, start: '22:00', end: '08:00' },
    muteWords: Array.isArray(muteWords)
      ? [...new Set(muteWords.map((w) => String(w).trim().toLowerCase()).filter((w) => w.length >= 2 && w.length <= 40))].slice(0, 30)
      : user.profile.muteWords || [],
    watch: Array.isArray(watch)
      ? [...new Set(watch.map((w) => String(w).trim().toLowerCase()).filter((w) => w.length >= 2 && w.length <= 40))].slice(0, 30)
      : user.profile.watch || [],
    language: LANGUAGES[language] ? language : user.profile.language || 'en'
  }
  putUser(user)
  const names = validTags.map((t) => tagById(t).label)
  const follow = user.profile.companies.map((c) => companyById(c).label)
  res.json({
    ok: true,
    message: `Saved. You’re following ${names.join(', ')}${follow.length ? `, and keeping a close eye on ${follow.join(', ')}` : ''}. ${scheduleText(user.profile)}${user.profile.learningMode ? ' Each item will include a short plain-language explanation.' : ''}${user.profile.quietHours.enabled ? ` No instant alerts between ${formatTime(user.profile.quietHours.start)} and ${formatTime(user.profile.quietHours.end)}.` : ''}${user.profile.muteWords.length ? ` Muted: ${user.profile.muteWords.join(', ')}.` : ''}${user.profile.watch.length ? ` Watching: ${user.profile.watch.join(', ')}.` : ''}${user.profile.language !== 'en' ? ` Summaries in ${LANGUAGES[user.profile.language]}.` : ''}`
  })
})

// ---- viaSocket: Connect ----
// Only the delivery apps in config/channels.json can be connected: the token endpoint refuses any other app,
// and a connection is stored only if it belongs to this user and to one of those apps.
app.get('/api/viasocket/token', async (req, res, next) => {
  try {
    const slugs = String(req.query.apps || '').split(',').filter(Boolean)
    if (slugs.some((s) => !allowedApps.includes(s))) return res.status(400).json({ error: 'That app is not available in Briefly.' })
    const serviceIds = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await serviceIdFor(slug)])))
    const actions = Object.fromEntries(slugs.map((s) => [s, [...new Set(delivery.channels.filter((c) => c.app === s).map((c) => c.action))]]))
    res.json({ token: await viasocket.user(req.userId).token(), serviceIds, actions })
  } catch (e) { next(e) }
})

app.post('/api/viasocket/connected', async (req, res, next) => {
  try {
    const { app: slug, authId } = req.body
    if (!allowedApps.includes(slug) || typeof authId !== 'string') return res.status(400).json({ error: 'Unknown app' })
    const serviceId = await serviceIdFor(slug)
    const live = await viasocket.user(req.userId).listConnections()
    const conn = live.find((c) => c.id === authId && c.service_id === serviceId)
    if (!conn) return res.status(400).json({ error: 'That connection was not found for your account. Please try connecting again.' })
    const user = currentUser(req)
    let label = ''
    try { label = Object.values(JSON.parse(conn.connection_label || '{}')).join(', ') } catch {}
    user.connections[slug] = { ...user.connections[slug], authId, label, connectedAt: new Date().toISOString() }
    putUser(user)
    await ensureEnabled(user, slug)
    res.json({ ok: true, message: `${delivery.apps[slug].name} is connected${label ? ` (${label})` : ''}.` })
  } catch (e) { next(e) }
})

// ---- viaSocket: Pick ----
app.get('/api/options', async (req, res, next) => {
  try {
    const { options: list } = await options(currentUser(req), req.query.channel, req.query.key, req.query.q)
    res.json({ options: list.map(({ label, value }) => ({ label, value })) })
  } catch (e) { next(e) }
})

app.post('/api/delivery', (req, res) => {
  const user = currentUser(req)
  const channel = channelById(req.body.channel)
  if (!channel) return res.status(400).json({ error: 'Choose where to deliver.' })
  if (!user.connections[channel.app]) return res.status(400).json({ error: `Connect ${delivery.apps[channel.app].name} first.` })
  const fields = {}
  for (const p of channel.pick || []) {
    const v = req.body.fields?.[p.key]
    if (!v || (Array.isArray(v) && !v.length)) return res.status(400).json({ error: `Choose: ${p.label}.` })
    fields[p.key] = p.multi ? [].concat(v) : String(v)
  }
  for (const a of channel.ask || []) {
    const v = String(req.body.fields?.[a.key] || '').trim()
    if (a.type === 'email' && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v)) return res.status(400).json({ error: 'Please enter a valid email address.' })
    fields[a.key] = v
  }
  user.delivery = { channel: channel.id, fields, labels: req.body.labels || {}, ready: true }
  user.onboarded = true
  putUser(user)
  const where = Object.values(req.body.labels || {}).flat().join(', ') || Object.values(fields).flat().join(', ')
  res.json({ ok: true, message: `Done. Briefly will deliver to ${channel.label}${where ? ` (${where})` : ''}.` })
})

// ---- viaSocket: Act ----
app.post('/api/test-message', async (req, res, next) => {
  try {
    const user = currentUser(req)
    const channel = channelById(user.delivery?.channel)
    if (!channel) return res.status(400).json({ error: 'Choose where to deliver first.' })
    const sample = [{ event: { url: 'https://github.com/', sources: ['github'] }, ai: { relevance: 100, topic: 'Welcome', headline: 'Briefly is set up', summary: 'This is a test message. Your updates will arrive here, in this format.', why_it_matters: 'You can stop scrolling feeds: what matters to you comes to you.', concept: user.profile.learningMode ? 'A digest bundles several updates into one message so your channel stays quiet.' : '' } }]
    await send(user, digestMessage(sample, channel.format, 'test'))
    res.json({ ok: true, message: `Test sent to ${channel.label}. Check it now.` })
  } catch (e) { next(e) }
})

app.get('/api/feed', (req, res) => {
  const db = load()
  const seen = userEvents(req.userId)
  const rows = Object.entries(seen).filter(([, s]) => s.ai && s.status !== 'skipped')
    .map(([id, s]) => ({ id, status: s.status, mode: s.mode, at: s.sentAt || s.at, vote: s.vote || 0, ...s.ai, url: db.events[id]?.url, sources: db.events[id]?.sources }))
    .sort((a, b) => b.relevance - a.relevance)
  const deliveries = db.deliveries.filter((d) => d.userId === req.userId).slice(0, 20).map(({ kind, ok, at, eventIds, detail }) => ({ kind, ok, at, count: eventIds.length, detail: ok ? undefined : 'Delivery did not go through; it will be retried with your next digest.' }))
  const sources = Object.entries(db.sourceStatus).map(([name, s]) => ({ name, ok: s.ok, at: s.at }))
  const user = getUser(req.userId)
  res.json({ items: rows, deliveries, sources, schedule: user ? { text: scheduleText(user.profile), next: nextDigestLabel(user.profile) } : null })
})

// 👍 / 👎 on a story: stored with the story, and the user's learned taste is rebuilt from all their votes
app.post('/api/feedback', (req, res) => {
  const user = getUser(req.userId)
  const { eventId, vote } = req.body
  const seen = user && userEvents(user.id)
  if (!seen?.[eventId]?.ai || ![1, -1, 0].includes(vote)) return res.status(400).json({ error: 'That story can’t be rated.' })
  Object.assign(seen[eventId], { vote, votedAt: new Date().toISOString() })
  if (!vote) delete seen[eventId].vote
  const learned = learn(user, seen, load().events)
  putUser(user)
  res.json({ ok: true, votes: learned.votes, message: vote > 0 ? 'Got it — more stories like this.' : vote < 0 ? 'Got it — fewer stories like this.' : 'Rating removed.' })
})

// Trend radar
app.get('/api/trends', (req, res) => {
  const user = currentUser(req)
  res.json(computeTrends(load().events, { tz: validTimeZone(user.profile.timezone) ? user.profile.timezone : 'UTC', profile: user.profile }))
})

// Ask Briefly
app.get('/api/ask', (req, res) => res.json({ messages: getUser(req.userId) ? chatLog(req.userId) : [] }))
app.post('/api/ask', async (req, res, next) => {
  try {
    const user = getUser(req.userId)
    if (!user?.onboarded) return res.status(400).json({ error: 'Finish setup first.' })
    const question = String(req.body.question || '').trim().slice(0, 500)
    if (!question && !req.body.newChat) return res.status(400).json({ error: 'Type a question.' })
    if (!question) { user.askThread = null; chatLog(user.id).length = 0; putUser(user); return res.json({ messages: [] }) }
    const reply = await ask(user, question, { newChat: !!req.body.newChat })
    putUser(user)
    res.json({ reply })
  } catch (e) { next(e) }
})

app.post('/api/check-now', async (req, res, next) => {
  try {
    const user = getUser(req.userId)
    if (!user?.onboarded) return res.status(400).json({ error: 'Finish setup first.' })
    await pollSources()
    const r = await processUser(user)
    res.json({ ok: true, message: r.assessed ? `Checked. ${r.instant} major update${r.instant === 1 ? '' : 's'} sent now, ${r.queued} saved for your digest.` : 'Checked. Nothing new for you right now.' })
  } catch (e) { next(e) }
})

app.post('/api/digest-now', async (req, res, next) => {
  try {
    const user = getUser(req.userId)
    if (!user?.onboarded) return res.status(400).json({ error: 'Finish setup first.' })
    const r = await deliverDigest(user, user.profile.frequency === 'weekly' ? 'weekly' : 'daily')
    res.json({ ok: true, message: r.sent ? `Digest with ${r.sent} update${r.sent === 1 ? '' : 's'} sent.` : 'Nothing is waiting for your digest yet.' })
  } catch (e) { next(e) }
})

app.use((err, req, res, next) => {
  console.error(err)
  // viaSocket answers 402 when the account's AI credits run out: say so plainly instead of "something went wrong"
  if (err.status === 402) return res.status(503).json({ error: 'Briefly’s AI is paused right now because the AI credits have run out. Please try again later.' })
  res.status(500).json({ error: 'Something went wrong on our side. Please try again in a moment.', detail: process.env.NODE_ENV === 'production' ? undefined : err.message })
})

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => console.log(`Briefly on http://localhost:${port}`))

// Timed jobs. A host with schedules (Embarko) calls these routes and sets CRON_SECRET; anywhere else the
// server runs them itself on a timer. Each answers at once and works in the background, one run at a time.
const running = {}
function job(name, fn) {
  return (req, res) => {
    if (!process.env.CRON_SECRET || req.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) return res.sendStatus(401)
    if (running[name]) return res.status(202).send(`${name} already running`)
    running[name] = fn().catch((e) => console.error(`[${name}]`, e.message)).finally(() => delete running[name])
    res.status(202).send(`${name} started`)
  }
}
app.get('/tasks/poll', job('poll', runCycle))
app.get('/tasks/digests', job('digests', runDigests))

if (!process.env.CRON_SECRET && process.env.BRIEFLY_SCHEDULER !== 'off') {
  const safe = (fn) => () => fn().catch((e) => console.error('[scheduler]', e.message))
  setTimeout(safe(runCycle), 5000)
  setInterval(safe(runCycle), engine.pollEveryMinutes * 60000)
  setInterval(safe(runDigests), engine.digestCheckEveryMinutes * 60000)
}
