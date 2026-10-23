import { connect, loadConnectScript } from '/vendor/viasocket-apps/browser.js'

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---------- icons (24px line icons) ----------
const ICONS = {
  layout: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/><circle cx="12" cy="3.5" r="1"/>',
  branch: '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M6 7.5v9M18 9.5c0 5-6 4-11.5 7"/>',
  paper: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  robot: '<path d="M7 20h10M12 20v-6M12 14l-5-5M7 9l3-3M15 6l-5 0"/><circle cx="12" cy="14" r="1.5"/><circle cx="7" cy="9" r="1.5"/><circle cx="16" cy="6" r="2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  up: '<path d="M7 10v11H3V10z"/><path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7"/>',
  down: '<path d="M17 14V3h4v11z"/><path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>'
}
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.sparkles}</svg>`
const paintIcons = (root = document) => $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon) })

// Each topic gets its own icon and hue so the grid reads at a glance.
const TOPIC_LOOK = {
  llms: ['chat', 262], agents: ['bot', 200], 'open-source': ['branch', 150], research: ['paper', 35], robotics: ['robot', 15],
  vision: ['image', 320], safety: ['shield', 120], 'dev-tools': ['code', 225], hardware: ['chip', 45], speech: ['mic', 285]
}
const tint = (hue) => `--h: ${hue}` // colors come from .tinted in the stylesheet, per theme
const SOURCES = { hackernews: ['Hacker News', '#ff6600', 'Y'], arxiv: ['arXiv', '#b31b1b', 'aX'], github: ['GitHub', '#2f363d', 'GH'], blogs: ['Company blogs', '#6e56cf', 'B'] }

// ---------- api + feedback ----------
const api = async (path, body) => {
  const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  // detail is the server's own reason, sent only outside production: it makes a screenshot enough to diagnose
  if (res.status === 401 && data.signIn) { location.reload(); throw new Error('Please sign in.') } // the session ended
  if (!res.ok) throw new Error((data.error || 'Something went wrong') + (data.detail ? ` (${data.detail})` : ''))
  return data
}
function toast(msg, error = false) {
  const t = $('#toast')
  t.textContent = msg
  t.className = error ? 'error' : ''
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 9000)
}
async function busy(btn, fn) {
  btn.disabled = true
  try { await fn() } catch (e) { toast(e.message, true) } finally { btn.disabled = false }
}

// ---------- state ----------
let catalog, me, embed
const state = { tags: new Set(), companies: new Set(), frequency: 'daily', digestTime: '09:00', digestDay: 1, learning: false, channel: null, fields: {}, labels: {}, app: null, feedTab: 'queued', quiet: { enabled: false, start: '22:00', end: '08:00' }, mute: [], watch: [], language: 'en' }
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const HEAD = {
  briefing: ['Your briefing', 'What’s new for you', 'Stories picked for your interests, and what is on its way to you. Rate stories with 👍 / 👎 and Briefly learns your taste.'],
  trends: ['Trend radar', 'What’s rising', 'What AI news is about this week compared with last week, counted across every source Briefly reads.'],
  ask: ['Ask Briefly', 'Ask about the news', 'Questions are answered only from the stories Briefly has collected, with a link to every source.'],
  interests: ['Step 1 · Interests', 'What should we watch?', 'Pick the topics you care about. We read Hacker News, new research papers and GitHub releases, and keep only what matches.'],
  schedule: ['Step 2 · Schedule', 'When should we reach you?', 'Choose how often updates arrive. Big launches can always come right away.'],
  delivery: ['Step 3 · Delivery', 'Where should it go?', 'Connect the app you already use. We never see your password; the connection is handled securely by viaSocket.']
}

// ---------- time helpers (browser-local, which is the user's time zone) ----------
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
function nextLabel() {
  const now = new Date()
  const [h, m] = state.digestTime.split(':').map(Number)
  const weekly = state.frequency === 'weekly'
  const mins = now.getHours() * 60 + now.getMinutes()
  let ahead = weekly ? (state.digestDay - now.getDay() + 7) % 7 : 0
  if (ahead === 0 && mins >= h * 60 + m) ahead = weekly ? 7 : 1
  const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : catalog.weekdays[(now.getDay() + ahead) % 7]
  return `${when} at ${fmtTime(state.digestTime)}`
}

// ---------- navigation ----------
function show(view) {
  if (['briefing', 'ask', 'trends'].includes(view) && !me.onboarded) view = 'interests'
  if (view !== (location.hash.slice(1) || view)) $('#toast').hidden = true // a message belongs to the page it came from
  for (const p of $$('.page')) p.hidden = p.dataset.page !== view
  for (const b of $$('#nav button')) b.classList.toggle('on', b.dataset.view === view)
  const [eyebrow, title, lede] = HEAD[view]
  $('#eyebrow').textContent = me.onboarded && !['briefing', 'ask', 'trends'].includes(view) ? 'Settings' : eyebrow
  $('#title').textContent = title
  $('#lede').textContent = lede
  $('#top-actions').innerHTML = ''
  if (view === 'briefing') {
    $('#top-actions').innerHTML = `<button class="btn ghost" id="check">${icon('refresh')}Check for news now</button><button class="btn primary" id="digest">${icon('send')}Send my digest now</button>`
    $('#check').onclick = (e) => busy(e.currentTarget, async () => { toast('Checking sources… this can take a minute.'); toast((await api('/api/check-now', {})).message); await renderBriefing() })
    $('#digest').onclick = (e) => busy(e.currentTarget, async () => { toast((await api('/api/digest-now', {})).message); await renderBriefing() })
    renderBriefing().catch((e) => toast(e.message, true))
  }
  if (view === 'trends') renderTrends().catch((e) => toast(e.message, true))
  if (view === 'ask') {
    $('#top-actions').innerHTML = `<button class="btn ghost" id="new-chat">${icon('plus')}New chat</button>`
    $('#new-chat').onclick = (e) => busy(e.currentTarget, async () => { await api('/api/ask', { newChat: true }); chat = []; drawChat() })
    renderAsk().catch((e) => toast(e.message, true))
  }
  for (const b of $$('[data-save]')) b.textContent = me.onboarded ? 'Save changes' : b.dataset.save === 'delivery' ? 'Finish setup' : 'Continue'
  location.hash = view
  window.scrollTo({ top: 0 })
}
function renderNav() {
  $('#nav [data-view=briefing]').hidden = !me.onboarded
  $('#nav [data-view=ask]').hidden = !me.onboarded
  $('#nav [data-view=trends]').hidden = !me.onboarded
  $('#nav [data-view=interests]').classList.toggle('done', me.profile.tags.length > 0 && (me.onboarded || !!me.saved?.interests))
  $('#nav [data-view=schedule]').classList.toggle('done', me.onboarded || !!me.saved?.schedule)
  $('#nav [data-view=delivery]').classList.toggle('done', !!me.delivery?.ready)
  const ch = catalog.channels.find((c) => c.id === me.delivery?.channel)
  $('#side-card').innerHTML = me.onboarded
    ? `<b>${esc(me.schedule?.next || '')}</b>Next digest${ch ? ` · ${esc(ch.label)}` : ''}<div class="dot-row">${icon('globe')}<span>${esc(TZ.replace(/_/g, ' '))}</span></div>`
    : `<b>Three quick steps</b>Pick topics, choose a schedule, connect where you want updates.`
}

// ---------- interests ----------
function renderInterests() {
  $('#tags').innerHTML = catalog.tags.map((t) => {
    const [ico, hue] = TOPIC_LOOK[t.id] || ['sparkles', 40]
    return `<button class="topic-tile" data-tag="${t.id}" aria-pressed="${state.tags.has(t.id)}"><span class="t-ico tinted" style="${tint(hue)}">${icon(ico)}</span><b>${esc(t.label)}</b><span class="tick">${icon('check')}</span></button>`
  }).join('')
  $('#companies').innerHTML = catalog.companies.map((c) =>
    `<button class="company" data-company="${c.id}" aria-pressed="${state.companies.has(c.id)}"><span class="mono">${esc(c.label.replace(/[^A-Za-z]/g, '').slice(0, 2))}</span>${esc(c.label)}</button>`).join('')
  const count = () => ($('#tag-count').textContent = `${state.tags.size} selected`)
  for (const b of $$('[data-tag]')) b.onclick = () => { const id = b.dataset.tag; state.tags.has(id) ? state.tags.delete(id) : state.tags.add(id); b.setAttribute('aria-pressed', state.tags.has(id)); count() }
  for (const b of $$('[data-company]')) b.onclick = () => { const id = b.dataset.company; state.companies.has(id) ? state.companies.delete(id) : state.companies.add(id); b.setAttribute('aria-pressed', state.companies.has(id)) }
  $('#learning').checked = state.learning
  $('#learning').onchange = (e) => (state.learning = e.target.checked)
  count()
  wordList('mute', 'Nothing muted.')
  wordList('watch', 'Nothing on your watchlist yet.')
  $('#language').innerHTML = catalog.languages.map((l) => `<option value="${l.id}" ${state.language === l.id ? 'selected' : ''}>${esc(l.label)}</option>`).join('')
  $('#language').onchange = (e) => (state.language = e.target.value)
}
// an editable list of words (mute words, watchlist): type one or several separated by commas, remove with ×
function wordList(key, empty) {
  const draw = () => {
    $(`#${key}-list`).innerHTML = state[key].length
      ? state[key].map((w, i) => `<span class="mute-chip">${esc(w)}<button type="button" data-i="${i}" aria-label="Remove ${esc(w)}">${icon('x')}</button></span>`).join('')
      : `<span class="hint">${empty}</span>`
    for (const b of $$(`#${key}-list [data-i]`)) b.onclick = () => { state[key].splice(+b.dataset.i, 1); draw() }
  }
  $(`#${key}-form`).onsubmit = (e) => {
    e.preventDefault()
    const words = $(`#${key}-input`).value.split(',').map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2)
    state[key] = [...new Set([...state[key], ...words])].slice(0, 30)
    $(`#${key}-input`).value = ''
    draw()
  }
  draw()
}

// ---------- schedule ----------
const timeOptions = (selected) => Array.from({ length: 48 }, (_, i) => {
  const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
  return `<option value="${t}" ${t === selected ? 'selected' : ''}>${fmtTime(t)}</option>`
}).join('')
const FREQ_ART = { instant: 'bolt', daily: 'sun', weekly: 'calendar' }
const QUICK = [['07:00', 'Early'], ['09:00', 'Morning'], ['13:00', 'After lunch'], ['18:00', 'Evening'], ['21:00', 'Night']]
function renderSchedule() {
  $('#freq').innerHTML = catalog.frequencies.map((f) =>
    `<button class="freq" role="radio" data-freq="${f.id}" aria-checked="${state.frequency === f.id}"><span class="freq-art">${icon(FREQ_ART[f.id])}</span><b>${esc(f.label)}</b><span>${esc(f.blurb)}</span><span class="radio"></span></button>`).join('')
  for (const b of $$('[data-freq]')) b.onclick = () => { state.frequency = b.dataset.freq; renderSchedule() }

  const weekly = state.frequency === 'weekly'
  $('#when-title').textContent = state.frequency === 'instant' ? 'When should the rest arrive?' : weekly ? 'Pick a day and time' : 'Pick a time'
  $('#tz-note').innerHTML = `${icon('globe')} Your time zone: ${esc(TZ.replace(/_/g, ' '))}`
  $('#day-row').hidden = !weekly
  $('#days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) =>
    `<button class="day" data-day="${d}" aria-pressed="${state.digestDay === d}">${catalog.weekdays[d].slice(0, 3)}</button>`).join('')
  for (const b of $$('[data-day]')) b.onclick = () => { state.digestDay = +b.dataset.day; renderSchedule() }

  $('#quick-times').innerHTML = QUICK.map(([t, name]) =>
    `<button data-time="${t}" aria-pressed="${state.digestTime === t}">${fmtTime(t)}<small>${name}</small></button>`).join('')
  for (const b of $$('[data-time]')) b.onclick = () => { state.digestTime = b.dataset.time; renderSchedule() }
  const sel = $('#time')
  sel.innerHTML = Array.from({ length: 48 }, (_, i) => {
    const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
    return `<option value="${t}" ${t === state.digestTime ? 'selected' : ''}>${fmtTime(t)}</option>`
  }).join('')
  sel.onchange = () => { state.digestTime = sel.value; renderSchedule() }

  const what = state.frequency === 'instant' ? 'Major news arrives right away; the rest comes' : weekly ? 'Your roundup arrives' : 'Your digest arrives'
  const every = weekly ? `every ${catalog.weekdays[state.digestDay]} at ${fmtTime(state.digestTime)}` : `every day at ${fmtTime(state.digestTime)}`
  $('#preview-text').innerHTML = `${what} <b>${every}</b>. Next one: <b>${esc(nextLabel())}</b>.`

  $('#quiet-on').checked = state.quiet.enabled
  $('#quiet-on').onchange = (e) => { state.quiet.enabled = e.target.checked; renderSchedule() }
  $('#quiet-times').hidden = !state.quiet.enabled
  $('#quiet-start').innerHTML = timeOptions(state.quiet.start)
  $('#quiet-end').innerHTML = timeOptions(state.quiet.end)
  $('#quiet-start').onchange = (e) => (state.quiet.start = e.target.value)
  $('#quiet-end').onchange = (e) => (state.quiet.end = e.target.value)
}

// ---------- delivery ----------
const appIcon = (app, size = 30) => `<img src="${esc(app.icon)}" alt="" width="${size}" height="${size}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge',textContent:'${esc(app.name[0])}'}))">`
function renderApps() {
  $('#apps').innerHTML = catalog.apps.map((app) => {
    const c = me.connections[app.slug]
    const stateText = !c ? '<span class="app-state">Not connected</span>' : c.expired ? '<span class="app-state exp">Needs reconnecting</span>' : `<span class="app-state ok">Connected${c.label ? ` · ${esc(c.label)}` : ''}</span>`
    const label = !c ? `Connect ${esc(app.name)}` : c.expired ? 'Reconnect' : state.app === app.slug ? 'Selected' : `Use ${esc(app.name)}`
    return `<div class="app-tile ${state.app === app.slug ? 'on' : ''}"><span class="app-logo">${appIcon(app)}</span><div><b>${esc(app.name)}</b><br>${stateText}</div><button class="btn ${c && !c.expired ? 'ghost' : 'primary'}" data-app="${app.slug}">${!c || c.expired ? icon('plug') : ''}${label}</button></div>`
  }).join('')
  for (const b of $$('[data-app]')) {
    const slug = b.dataset.app, c = me.connections[slug]
    b.onclick = () => (c && !c.expired ? chooseApp(slug) : connectApp(slug, c?.expired ? c.authId : undefined, b))
  }
}

async function connectApp(slug, authId, btn, after = chooseApp) {
  const save = async (id) => {
    const r = await api('/api/viasocket/connected', { app: slug, authId: id })
    toast(r.message)
    me = await api('/api/me')
    after(slug)
  }
  btn.disabled = true
  try {
    // the popup opens straight from this click: the token was fetched on page load
    const { authId: id } = await connect({
      embedToken: embed.token, serviceId: embed.serviceIds[slug], actions: embed.actions[slug], skipActionSelection: true,
      ...(authId ? { authId } : {}),
      onLateSuccess: ({ authId }) => save(authId).catch((e) => toast(e.message, true))
    })
    await save(id)
  } catch (e) {
    if (e.code !== 'closed') toast(e.message, true)
  } finally { btn.disabled = false }
}

function chooseApp(slug) {
  state.app = slug
  renderApps()
  const list = catalog.channels.filter((c) => c.app === slug)
  $('#channel-box').hidden = false
  if (!list.some((c) => c.id === state.channel)) selectChannel(list[0].id)
  else renderChannels()
}
function renderChannels() {
  const list = catalog.channels.filter((c) => c.app === state.app)
  $('#channels').innerHTML = list.map((c) =>
    `<button class="channel" role="radio" data-channel="${c.id}" aria-checked="${state.channel === c.id}"><span class="radio"></span><span><b>${esc(c.label)}</b><span>${esc(c.hint)}</span></span></button>`).join('')
  for (const b of $$('[data-channel]')) b.onclick = () => selectChannel(b.dataset.channel)
  renderFields()
}
function selectChannel(id) {
  if (state.channel !== id) { state.fields = {}; state.labels = {} }
  state.channel = id
  renderChannels()
}
function renderFields() {
  const ch = catalog.channels.find((c) => c.id === state.channel)
  const box = $('#fields')
  box.innerHTML = ''
  for (const a of ch.ask) {
    const f = document.createElement('div')
    f.className = 'field'
    f.innerHTML = `<label>${esc(a.label)}</label><input class="input" type="email" placeholder="you@example.com" value="${esc(state.fields[a.key] || '')}">`
    f.querySelector('input').oninput = (e) => (state.fields[a.key] = e.target.value)
    box.append(f)
  }
  for (const p of ch.pick) {
    const f = document.createElement('div')
    f.className = 'field'
    f.innerHTML = `<label>${esc(p.label)}</label><input class="input" type="search" placeholder="Search…"><select ${p.multi ? 'multiple' : ''}><option disabled>Loading…</option></select>`
    const search = f.querySelector('input'), select = f.querySelector('select')
    const load = async (q = '') => {
      try {
        const { options } = await api(`/api/options?channel=${ch.id}&key=${encodeURIComponent(p.key)}&q=${encodeURIComponent(q)}`)
        const chosen = [].concat(state.fields[p.key] || [])
        select.innerHTML = options.length
          ? (p.multi ? '' : '<option value="">Choose…</option>') + options.map((o) => `<option value="${esc(o.value)}" ${chosen.includes(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')
          : '<option disabled>Nothing found</option>'
      } catch (e) { select.innerHTML = `<option disabled>${esc(e.message)}</option>` }
    }
    let t
    search.oninput = () => { clearTimeout(t); t = setTimeout(() => load(search.value), 350) }
    select.onchange = () => {
      const sel = [...select.selectedOptions].filter((o) => o.value)
      state.fields[p.key] = p.multi ? sel.map((o) => o.value) : sel[0]?.value
      state.labels[p.key] = sel.map((o) => o.textContent)
    }
    box.append(f)
    load()
  }
}

// ---------- two-way replies ----------
function renderReplies() {
  const r = me.replies || {}
  $('#replies-card').hidden = !(r.possible || r.enabled)
  $('#replies-on').checked = !!r.enabled
  $('#replies-on').onchange = async (e) => {
    const on = e.target.checked
    e.target.disabled = true
    try { toast((await api('/api/replies', { enabled: on })).message); me = await api('/api/me') } catch (err) { toast(err.message, true); e.target.checked = !on }
    e.target.disabled = false
  }
}

// ---------- save stories to (one-click actions) ----------
function renderSaveTargets() {
  $('#save-targets').innerHTML = catalog.actions.map((a) => {
    const c = me.connections[a.app], t = me.saveTargets?.[a.id]
    const where = t ? Object.values(t.labels || {}).flat().join(' › ') : ''
    const state = t ? `<span class="app-state ok">Saving to ${esc(where || a.label)}</span>` : c && !c.expired ? '<span class="app-state">Connected · choose where</span>' : '<span class="app-state">Not connected</span>'
    const label = !c || c.expired ? `${icon('plug')}Connect ${esc(a.label)}` : t ? 'Change' : 'Choose where'
    return `<div class="app-tile ${t ? 'on' : ''}"><span class="app-logo">${appIcon({ icon: a.icon, name: a.label })}</span><div><b>${esc(a.label)}</b><br>${state}</div><button class="btn ${c && !c.expired ? 'ghost' : 'primary'}" data-target="${a.id}">${label}</button></div>`
  }).join('')
  for (const b of $$('[data-target]')) {
    const a = catalog.actions.find((x) => x.id === b.dataset.target), c = me.connections[a.app]
    b.onclick = () => (c && !c.expired ? chooseTarget(a) : connectApp(a.app, c?.expired ? c.authId : undefined, b, () => { renderSaveTargets(); chooseTarget(a) }))
  }
}
function chooseTarget(a) {
  const chosen = {}, labels = {}
  const box = $('#target-box')
  box.innerHTML = `<p class="hint target-hint">${esc(a.hint)}</p>` + a.pick.map((p) => `<div class="field"><label>${esc(p.label)}</label><select data-pick="${p.key}" ${p.after ? 'disabled' : ''}><option value="">${p.after ? 'Choose the ' + esc(a.pick.find((x) => x.key === p.after).label.toLowerCase()) + ' first' : 'Loading…'}</option></select></div>`).join('') +
    `<div class="page-actions"><button class="btn primary" id="target-save">Save</button></div>`
  const load = async (p) => {
    const sel = $(`[data-pick="${p.key}"]`)
    sel.disabled = true
    sel.innerHTML = '<option value="">Loading…</option>'
    try {
      const { options } = await api(`/api/action-options?action=${a.id}&key=${encodeURIComponent(p.key)}&existing=${encodeURIComponent(JSON.stringify(chosen))}`)
      sel.innerHTML = '<option value="">Choose…</option>' + options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')
      sel.disabled = false
    } catch (e) { sel.innerHTML = `<option value="">${esc(e.message)}</option>` }
  }
  for (const p of a.pick) {
    $(`[data-pick="${p.key}"]`).onchange = (e) => {
      chosen[p.key] = e.target.value
      labels[p.key] = e.target.selectedOptions[0]?.textContent
      for (const next of a.pick.filter((x) => x.after === p.key)) { delete chosen[next.key]; delete labels[next.key]; if (e.target.value) load(next) }
    }
  }
  a.pick.filter((p) => !p.after).forEach(load)
  $('#target-save').onclick = (e) => busy(e.currentTarget, async () => {
    const r = await api('/api/save-target', { action: a.id, fields: chosen, labels })
    toast(r.message)
    me = await api('/api/me')
    box.innerHTML = ''
    renderSaveTargets()
  })
}

// ---------- briefing ----------
function story(r) {
  const tag = catalog.tags.find((t) => t.label === r.topic)
  const [ico, hue] = tag ? TOPIC_LOOK[tag.id] || ['sparkles', 40] : catalog.companies.some((c) => c.label === r.topic) ? ['building', 40] : ['sparkles', 40]
  const sources = (r.sources || []).map((s) => `<span class="pill">${esc(SOURCES[s]?.[0] || s)}</span>`).join('')
  return `<article class="story"><span class="story-ico tinted" style="${tint(hue)}">${icon(ico)}</span><div>
    <div class="story-top"><span class="topic" style="--h: ${hue}">${esc(r.topic)}</span><span class="meter" title="How well it matches your interests"><i style="--v:${Math.max(0, Math.min(100, r.relevance))}%"></i>${r.relevance}</span></div>
    <h3>${esc(r.headline)}</h3><p>${esc(r.summary)}</p><p class="why"><b>Why it matters:</b> ${esc(r.why_it_matters)}</p>
    ${r.concept ? `<div class="concept">${icon('book')}<span>${esc(r.concept)}</span></div>` : ''}
    <div class="story-foot"><div class="pills">${sources}</div><div class="foot-right">
      <span class="votes">${catalog.actions.filter((a) => me.saveTargets?.[a.id]).map((a) => `<button class="vote save ${r.savedTo.includes(a.id) ? 'on' : ''}" data-save-story="${esc(r.id)}" data-action="${a.id}" title="${esc(a.verb)}" aria-label="${esc(a.verb)}">${icon('bookmark')}</button>`).join('')}<button class="vote ${r.vote > 0 ? 'on' : ''}" data-vote="1" data-id="${esc(r.id)}" title="More like this" aria-pressed="${r.vote > 0}">${icon('up')}</button><button class="vote down ${r.vote < 0 ? 'on' : ''}" data-vote="-1" data-id="${esc(r.id)}" title="Fewer like this" aria-pressed="${r.vote < 0}">${icon('down')}</button></span>
      <a class="read" href="${esc(r.url)}" target="_blank" rel="noopener">Read the source ${icon('arrow')}</a></div></div>
  </div></article>`
}
let feed = null
const TAB_FILTER = { queued: (r) => r.status === 'queued', instant: (r) => r.mode === 'instant' && r.status === 'sent', digested: (r) => r.mode === 'digest' && r.status === 'sent' }
function renderFeedList() {
  const rows = feed.items.filter(TAB_FILTER[state.feedTab])
  const empty = { queued: 'Nothing waiting yet. New stories show up here after the next check.', instant: 'No major launches sent yet. When something big lands, it arrives right away.', digested: 'No digest delivered yet.' }[state.feedTab]
  $('#feed-list').innerHTML = rows.length ? rows.map(story).join('') : `<div class="empty">${icon('inbox')}<span>${empty}</span></div>`
  for (const b of $$('#feed-tabs button')) b.classList.toggle('on', b.dataset.tab === state.feedTab)
  for (const b of $$('[data-save-story]')) b.onclick = () => busy(b, async () => {
    const item = feed.items.find((r) => r.id === b.dataset.saveStory)
    toast((await api(`/api/stories/${encodeURIComponent(item.id)}/save`, { action: b.dataset.action })).message)
    item.savedTo = [...new Set([...item.savedTo, b.dataset.action])]
    renderFeedList()
  })
  for (const b of $$('[data-vote]')) b.onclick = async () => {
    const item = feed.items.find((r) => r.id === b.dataset.id)
    const vote = item.vote === +b.dataset.vote ? 0 : +b.dataset.vote // clicking again removes the rating
    try { toast((await api('/api/feedback', { eventId: item.id, vote })).message); item.vote = vote; renderFeedList() } catch (e) { toast(e.message, true) }
  }
}
async function renderBriefing() {
  feed = await api('/api/feed')
  const count = (f) => feed.items.filter(f).length
  const live = feed.sources.filter((s) => s.ok).length
  const stats = [
    ['bolt', 45, count((r) => r.mode === 'instant' && r.status === 'sent'), 'Major alerts sent'],
    ['inbox', 225, count((r) => r.status === 'queued'), 'Waiting for your digest'],
    ['check', 150, count((r) => r.mode === 'digest' && r.status === 'sent'), 'Delivered in digests'],
    ['globe', 262, `${live}/${Object.keys(SOURCES).length}`, 'Sources live']
  ]
  $('#stats').innerHTML = stats.map(([i, hue, n, label]) => `<div class="stat"><span class="stat-ico tinted" style="${tint(hue)}">${icon(i)}</span><div><b>${n}</b><span>${label}</span></div></div>`).join('')
  if (feed.schedule) { $('#next-digest').textContent = feed.schedule.next; $('#schedule-text').textContent = feed.schedule.text }
  $('#sources').innerHTML = Object.entries(SOURCES).map(([id, [name, color, mark]]) => {
    const s = feed.sources.find((x) => x.name === id)
    const when = s ? `${s.ok ? 'Checked' : 'Unreachable'} ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not checked yet'
    return `<div class="source"><span class="source-logo" style="background:${color}">${mark}</span><div><b>${name}</b><span>${when}</span></div><i class="status-dot ${s && !s.ok ? 'off' : ''}" ${s ? '' : 'style="opacity:.3"'}></i></div>`
  }).join('')
  $('#deliveries').innerHTML = feed.deliveries.length
    ? feed.deliveries.slice(0, 8).map((d) => `<div class="tl ${d.ok ? '' : 'bad'}"><b>${esc(d.kind)}</b><span>${d.count} stor${d.count === 1 ? 'y' : 'ies'} · ${new Date(d.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${d.ok ? '' : ' · will retry'}</span></div>`).join('')
    : `<div class="empty">${icon('send')}<span>Nothing delivered yet.</span></div>`
  // open on the first tab with something in it, the first time only
  if (!renderBriefing.opened) {
    renderBriefing.opened = true
    state.feedTab = ['queued', 'instant', 'digested'].find((t) => feed.items.some(TAB_FILTER[t])) || 'queued'
  }
  renderFeedList()
}

// ---------- trends ----------
const delta = (n) => (n > 0 ? `<span class="up">▲ ${n}</span>` : n < 0 ? `<span class="down">▼ ${-n}</span>` : '<span class="flat">no change</span>')
const srTable = (caption, head, rows) => `<table class="sr-only"><caption>${caption}</caption><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`
function hbars(rows, caption) {
  if (!rows.length) return '<div class="empty">Not enough stories yet.</div>'
  const max = Math.max(...rows.map((r) => r.thisWeek), 1)
  return rows.slice(0, 10).map((r) => `<div class="hbar" data-tip="${esc(r.label)}: ${r.thisWeek} this week, ${r.lastWeek} last week">
      <span class="hbar-label">${esc(r.label)}${r.yours ? ' <em>following</em>' : ''}</span>
      <span class="hbar-track"><i style="width:${(r.thisWeek / max) * 100}%"></i><b>${r.thisWeek}</b></span>
      <span class="hbar-delta">${delta(r.change)}</span></div>`).join('') +
    srTable(caption, ['Name', 'This week', 'Last week'], rows.map((r) => [r.label, r.thisWeek, r.lastWeek]))
}
async function renderTrends() {
  const t = await api('/api/trends')
  const top = t.topics[0], rise = t.rising[0]
  $('#trend-stats').innerHTML = [
    ['trend', 45, t.totals.thisWeek, 'Stories this week', delta(t.totals.thisWeek - t.totals.lastWeek)],
    ['sparkles', 262, top ? esc(top.label) : '—', 'Biggest topic this week', top ? `${top.thisWeek} stories` : ''],
    ['bolt', 150, rise ? esc(rise.term) : '—', 'Fastest-rising word', rise ? `${rise.lastWeek} → ${rise.thisWeek} mentions` : '']
  ].map(([i, hue, value, label, sub]) => `<div class="stat"><span class="stat-ico tinted" style="${tint(hue)}">${icon(i)}</span><div><b class="stat-value">${value}</b><span>${label}</span><small>${sub}</small></div></div>`).join('')

  const max = Math.max(...t.daily.map((d) => d.stories), 1)
  // a clean axis maximum: 1, 2 or 5 times a power of ten, so the midpoint is a round number too
  const pow = 10 ** Math.floor(Math.log10(max)), nice = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((v) => v >= max && Number.isInteger(v / 2)) || 2 * pow
  const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
  $('#daily').innerHTML = `<div class="dcol-axis"><span>${nice}</span><span>${nice / 2}</span><span>0</span></div>
    <div class="dcol-plot">${t.daily.map((d, i) => `<div class="dcol" data-tip="${fmt(d.day)}: ${d.stories} stor${d.stories === 1 ? 'y' : 'ies'}"><i style="height:${(d.stories / nice) * 100}%"></i><small>${i % 2 === 1 || t.daily.length - 1 === i ? fmt(d.day) : ''}</small></div>`).join('')}</div>` +
    srTable('Stories per day', ['Day', 'Stories'], t.daily.map((d) => [fmt(d.day), d.stories]))
  $('#topic-bars').innerHTML = hbars(t.topics, 'Topics this week and last week')
  $('#company-bars').innerHTML = hbars(t.companies, 'Companies this week and last week')
  $('#rising').innerHTML = t.rising.length
    ? t.rising.map((r) => `<span class="rise-chip"><b>${esc(r.term)}</b><small>${r.lastWeek} → ${r.thisWeek}</small></span>`).join('')
    : '<div class="empty">Nothing is clearly rising yet. Check back after a few days of news.</div>'

  // one tooltip for every bar and column
  const tip = $('#chart-tip')
  for (const el of $$('[data-page=trends] [data-tip]')) {
    el.onmouseenter = el.onfocus = () => { tip.textContent = el.dataset.tip; tip.hidden = false; const r = el.getBoundingClientRect(); tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${r.top - 8}px` }
    el.onmouseleave = el.onblur = () => (tip.hidden = true)
    el.tabIndex = 0
  }
}

// ---------- ask ----------
const SUGGEST = ['What did OpenAI announce this week?', 'Any new open-source model releases?', 'What’s new in research on AI agents?', 'What changed in vLLM recently?']
let chat = []
let asking = false
async function renderAsk() { chat = (await api('/api/ask')).messages; drawChat() }
function bubble(m) {
  if (m.role === 'user') return `<div class="msg me">${esc(m.text)}</div>`
  const text = esc(m.text).replace(/\[(\d+)\]/g, '<sup class="cite">$1</sup>').replace(/\n/g, '<br>')
  const cites = (m.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"><span class="cite-n">${s.n}</span><span class="cite-t">${esc(s.title)}</span><small>${esc(s.source || '')}</small></a>`).join('')
  return `<div class="msg ai"><div>${text}</div>${cites ? `<div class="cites">${cites}</div>` : ''}</div>`
}
function drawChat() {
  const log = $('#chat-log')
  log.innerHTML = chat.length
    ? chat.map(bubble).join('') + (asking ? '<div class="msg ai typing" aria-label="Briefly is thinking"><i></i><i></i><i></i></div>' : '')
    : `<div class="chat-empty">${icon('chat')}<b>Ask anything about AI news</b><span>Briefly answers from the stories it has collected and shows where each fact came from.</span></div>`
  $('#suggest').hidden = chat.length > 0
  $('#suggest').innerHTML = SUGGEST.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')
  for (const b of $$('[data-q]')) b.onclick = () => askQuestion(b.dataset.q)
  $('#ask-send').disabled = asking
  log.scrollTop = log.scrollHeight
}
async function askQuestion(q) {
  q = q.trim()
  if (!q || asking) return
  asking = true
  chat.push({ role: 'user', text: q })
  $('#ask-input').value = ''
  drawChat()
  try { chat.push((await api('/api/ask', { question: q })).reply) } catch (e) { chat.push({ role: 'assistant', text: `Sorry, that didn’t work: ${e.message}`, sources: [] }) }
  asking = false
  drawChat()
}

// ---------- saving ----------
const saved = {} // steps saved during setup, for the checkmarks in the menu
async function saveProfile() {
  const r = await api('/api/profile', {
    tags: [...state.tags], companies: [...state.companies], frequency: state.frequency, learningMode: state.learning,
    digestTime: state.digestTime, digestDay: state.digestDay, timezone: TZ, quietHours: state.quiet, muteWords: state.mute, watch: state.watch, language: state.language
  })
  return r.message
}
async function save(section, btn) {
  await busy(btn, async () => {
    if (!state.tags.size) { show('interests'); throw new Error('Pick at least one topic.') }
    let msg = await saveProfile()
    if (section === 'delivery' || (me.onboarded && state.channel && state.channel !== me.delivery?.channel)) {
      if (!state.channel) throw new Error('Connect an app and choose where to deliver.')
      msg = (await api('/api/delivery', { channel: state.channel, fields: state.fields, labels: state.labels })).message
    }
    const wasOnboarded = me.onboarded
    me = await api('/api/me')
    saved[section] = true
    me.saved = saved
    renderNav()
    renderReplies()
    $('#test').hidden = !me.delivery?.ready
    toast(msg)
    // during setup each step leads to the next; afterwards Save keeps you where you are
    if (!wasOnboarded) show({ interests: 'schedule', schedule: 'delivery', delivery: 'briefing' }[section])
  })
}

// ---------- sign in ----------
function showAuth() {
  $('#auth').hidden = false
  let mode = 'login'
  const setMode = (m) => {
    mode = m
    for (const b of $$('#auth-tabs button')) b.classList.toggle('on', b.dataset.mode === m)
    $('#auth-title').textContent = m === 'login' ? 'Welcome back' : 'Create your account'
    $('#auth-submit').textContent = m === 'login' ? 'Sign in' : 'Create account'
    $('#name-field').hidden = m === 'login'
    $('#pw-hint').hidden = m === 'login'
    $('#auth-password').autocomplete = m === 'login' ? 'current-password' : 'new-password'
    $('#auth-error').hidden = true
  }
  for (const b of $$('#auth-tabs button')) b.onclick = () => setMode(b.dataset.mode)
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault()
    const btn = $('#auth-submit')
    btn.disabled = true
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#auth-email').value, password: $('#auth-password').value, name: $('#auth-name').value })
    })
    const data = await res.json().catch(() => ({}))
    btn.disabled = false
    if (res.ok) return location.assign('/') // start fresh, not on the page the last person had open
    $('#auth-error').textContent = data.error || 'Something went wrong. Please try again.'
    $('#auth-error').hidden = false
  }
  $('#auth-email').focus()
}
function renderAccount() {
  const a = me.account
  $('#account').innerHTML = `<span class="avatar">${esc((a.name || a.email)[0].toUpperCase())}</span><span class="who"><b>${esc(a.name)}</b><small>${esc(a.email)}</small></span><button class="link" id="sign-out" title="Sign out">Sign out</button>`
  $('#sign-out').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.assign('/') }
}

// ---------- start ----------
async function init() {
  paintIcons()
  const { account } = await fetch('/api/auth/me').then((r) => r.json())
  if (!account) return showAuth()
  ;[catalog, me] = await Promise.all([api('/api/catalog'), api('/api/me')])
  renderAccount()
  // The token is fetched on page load, not in the click: the popup must open straight from the click.
  embed = await api(`/api/viasocket/token?apps=${catalog.apps.map((a) => a.slug).join(',')}`)
  loadConnectScript()
  me.profile.tags.forEach((t) => state.tags.add(t))
  me.profile.companies.forEach((c) => state.companies.add(c))
  Object.assign(state, {
    frequency: me.profile.frequency, digestTime: me.profile.digestTime || '09:00', digestDay: me.profile.digestDay ?? 1, learning: !!me.profile.learningMode,
    quiet: { ...state.quiet, ...(me.profile.quietHours || {}) }, mute: [...(me.profile.muteWords || [])], watch: [...(me.profile.watch || [])], language: me.profile.language || 'en',
    channel: me.delivery?.channel, fields: { ...(me.delivery?.fields || {}) }, labels: { ...(me.delivery?.labels || {}) }
  })
  renderInterests()
  renderSchedule()
  renderApps()
  renderSaveTargets()
  renderReplies()
  if (state.channel) chooseApp(catalog.channels.find((c) => c.id === state.channel).app)
  $('#test').hidden = !me.delivery?.ready
  $('#test').onclick = (e) => busy(e.currentTarget, async () => toast((await api('/api/test-message', {})).message))
  for (const b of $$('[data-save]')) b.onclick = () => save(b.dataset.save, b)
  for (const b of $$('#nav button')) b.onclick = () => show(b.dataset.view)
  for (const b of $$('#feed-tabs button')) b.onclick = () => { state.feedTab = b.dataset.tab; renderFeedList() }
  $('#ask-form').onsubmit = (e) => { e.preventDefault(); askQuestion($('#ask-input').value) }
  renderNav()
  const wanted = location.hash.slice(1)
  show(HEAD[wanted] ? wanted : me.onboarded ? 'briefing' : 'interests')
  $('#shell').hidden = false // only once every button works
  // back/forward and links like #schedule switch sections too
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (HEAD[v] && $(`.page[data-page=${v}]`).hidden) show(v) })
}
init().catch((e) => toast(e.message, true))
