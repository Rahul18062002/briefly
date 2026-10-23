// Plain-language messages for each channel family. No raw source metadata, one link per item.
import { engine } from './config.js'

const SOURCE_NAMES = { hackernews: 'Hacker News', arxiv: 'arXiv', github: 'GitHub', blogs: 'Official blog' }
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const alsoOn = (ev) => (ev.sources.length > 1 ? ` (also on ${ev.sources.slice(1).map((s) => SOURCE_NAMES[s]).join(', ')})` : '')

function itemText(entry, style) {
  const { summary, why_it_matters: why, concept } = entry.ai
  const headline = entry.n ? `${entry.n}. ${entry.ai.headline}` : entry.ai.headline // numbered in digests: "explain 3" in a reply
  const link = entry.event.url
  const src = SOURCE_NAMES[entry.event.sources[0]] + alsoOn(entry.event)
  if (style === 'slack')
    return [`*${headline}*`, summary, `_Why it matters:_ ${why}`, concept && `:bulb: ${concept}`, `${src}: ${link}`].filter(Boolean).join('\n')
  if (style === 'discord')
    return [`**${headline}**`, summary, `*Why it matters:* ${why}`, concept && `💡 ${concept}`, `${src}: <${link}>`].filter(Boolean).join('\n')
  return `<h3 style="margin:16px 0 4px;font-size:16px">${esc(headline)}</h3>
<p style="margin:0 0 4px">${esc(summary)}</p>
<p style="margin:0 0 4px"><i>Why it matters:</i> ${esc(why)}</p>
${concept ? `<p style="margin:0 0 4px;color:#555">💡 ${esc(concept)}</p>` : ''}
<p style="margin:0"><a href="${esc(link)}">Read on ${esc(src)}</a></p>`
}

export function instantMessage(entry, style) {
  const watch = entry.ai.watch // a watchlist match is sent right away, whatever its rank
  const subject = watch ? `Briefly watchlist: ${watch} · ${entry.ai.headline}` : `Briefly: ${entry.ai.headline}`
  const why = watch ? `Sent right away because it mentions “${esc(watch)}”, which is on your watchlist.` : 'Sent right away because it’s a major update that matches your interests.'
  if (style === 'email')
    return { subject, body: `<div style="font-family:system-ui,sans-serif;max-width:600px">${itemText(entry, style)}<p style="color:#888;font-size:12px;margin-top:20px">${why}</p></div>` }
  const prefix = watch
    ? (style === 'slack' ? `:eyes: *Briefly watchlist: ${watch}*` : `👀 **Briefly watchlist: ${watch}**`)
    : (style === 'slack' ? ':zap: *Briefly: major update*' : '⚡ **Briefly: major update**')
  return { subject, body: `${prefix}\n${itemText(entry, style)}` }
}

// One line per item for the "Also worth a look" list: headline and link (plus topic in email), nothing dropped.
function quickLine(entry, style) {
  const { headline, topic } = entry.ai
  const link = entry.event.url
  if (style === 'slack') return `${entry.n}. ${headline}: ${link}`
  if (style === 'discord') return `${entry.n}. ${headline}: <${link}>`
  return `<li style="margin:0 0 6px"><a href="${esc(link)}">${esc(headline)}</a> <span style="color:#888">(${esc(topic)})</span></li>`
}

/**
 * A digest: the most relevant items in full (summary, why it matters, link), grouped by topic, then every
 * other item as one line under "Also worth a look". Usually one or two messages; no item is left out.
 */
/** The weekly AI analysis as the opening section of a roundup. */
function analysisText(a, style) {
  if (style === 'email') return `<div style="background:#f6f1e7;border-radius:12px;padding:16px 18px;margin:12px 0 8px">
<h2 style="margin:0 0 6px;font-size:17px">${esc(a.title)}</h2><p style="margin:0 0 10px">${esc(a.overview)}</p>
${a.trends.map((t, i) => `<p style="margin:0 0 8px"><b>${i + 1}. ${esc(t.name)}.</b> ${esc(t.what_changed)} <i>${esc(t.why_it_matters)}</i>${t.sources.length ? ` ${t.sources.map((s) => `<a href="${esc(s.url)}">[${s.n}]</a>`).join(' ')}` : ''}</p>`).join('')}
${a.watch.length ? `<p style="margin:8px 0 0;color:#555"><b>Watch next week:</b> ${a.watch.map(esc).join(' · ')}</p>` : ''}</div>`
  const b = style === 'slack' ? (x) => `*${x}*` : (x) => `**${x}**`
  const i = style === 'slack' ? (x) => `_${x}_` : (x) => `*${x}*`
  const link = style === 'slack' ? (u) => u : (u) => `<${u}>`
  return [
    `${style === 'slack' ? ':crystal_ball:' : '🔮'} ${b(a.title)}`, a.overview,
    ...a.trends.map((t, n) => `${b(`${n + 1}. ${t.name}`)}: ${t.what_changed} ${i(t.why_it_matters)}${t.sources[0] ? ` ${link(t.sources[0].url)}` : ''}`),
    a.watch.length ? `${b('Watch next week:')} ${a.watch.join(' · ')}` : ''
  ].filter(Boolean).join('\n')
}

export function digestMessage(entries, style, period, topCount = engine.digestTopStories, analysis = null) {
  const sorted = [...entries].sort((a, b) => b.ai.relevance - a.ai.relevance)
  const top = sorted.slice(0, topCount), rest = sorted.slice(topCount)
  const groups = {}
  for (const e of top) (groups[e.ai.topic || 'Other'] ??= []).push(e)
  // numbers follow reading order (top stories by topic, then the quick list) and run across every message part
  const order = [...Object.values(groups).flat(), ...rest]
  const numbered = new Map(order.map((e, i) => [e, { ...e, n: i + 1 }]))
  for (const list of [...Object.values(groups), rest]) list.forEach((e, i) => (list[i] = numbered.get(e)))
  const ids = order.map((e) => e.event.id)
  const title = `Your ${period} Briefly: ${entries.length} update${entries.length === 1 ? '' : 's'}`
  if (style === 'email') {
    const h2 = (text) => `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #eee;padding-bottom:4px;margin-top:28px">${esc(text)}</h2>`
    const html = Object.entries(groups).map(([topic, list]) => `${h2(topic)}${list.map((e) => itemText(e, style)).join('')}`).join('') +
      (rest.length ? `${h2('Also worth a look')}<ul style="padding-left:18px">${rest.map((e) => quickLine(e, style)).join('')}</ul>` : '')
    return Object.assign([{ subject: title, body: `<div style="font-family:system-ui,sans-serif;max-width:600px"><h1 style="font-size:20px">${esc(title)}</h1>${analysis ? analysisText(analysis, style) : ''}${html}</div>` }], { ids })
  }
  const heading = (text) => (style === 'slack' ? `*${text.toUpperCase()}*` : `__**${text}**__`)
  // Pieces are never split; a blank line separates sections and full items, a line break separates quick lines.
  const pieces = [{ text: style === 'slack' ? `:newspaper: *${title}*` : `📰 **${title}**` }]
  if (analysis) pieces.push({ text: analysisText(analysis, style) }) // the week in brief opens a weekly roundup
  for (const [topic, list] of Object.entries(groups)) pieces.push({ text: heading(topic) }, ...list.map((e) => ({ text: itemText(e, style) })))
  if (rest.length) pieces.push({ text: heading('Also worth a look') }, ...rest.map((e, i) => ({ text: quickLine(e, style), tight: i > 0 })))
  // Discord caps a message at 2000 characters and long Slack messages get cut up: split between pieces only.
  const limit = style === 'discord' ? 1900 : 3800
  const parts = []
  let current = ''
  // a piece longer than one message (a long analysis on Discord) is split between its lines
  const fitted = pieces.flatMap((p) => (p.text.length <= limit ? [p] : p.text.split('\n').map((line, i) => ({ text: line.slice(0, limit), tight: i > 0 || p.tight }))))
  for (const { text, tight } of fitted) {
    const joined = current ? current + (tight ? '\n' : '\n\n') + text : text
    if (current && joined.length > limit) { parts.push(current); current = text } else current = joined
  }
  // A short leftover joins the previous message when that still fits the platform's hard cap.
  const hardCap = style === 'discord' ? 2000 : 4000
  if (parts.length && current.length < 400 && parts.at(-1).length + current.length + 2 <= hardCap) parts.push(parts.pop() + '\n' + current)
  else parts.push(current)
  return Object.assign(parts.map((body) => ({ subject: title, body })), { ids }) // ids: event ids by number (1 = ids[0])
}
