// Official company blogs through their public RSS/Atom feeds: where model launches are announced first.
// Only the title, a short excerpt and the link are kept; the post itself stays on the company's site.
const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&')
const text = (s = '') => decode(decode(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const tag = (xml, names) => {
  for (const name of names) {
    const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
    if (m) return m[1]
  }
  return ''
}
function link(entry) {
  const rss = text(tag(entry, ['link']))
  if (rss.startsWith('http')) return rss
  const atom = entry.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i) || entry.match(/<link\b[^>]*href=["']([^"']+)/i)
  return atom ? decode(atom[1]) : ''
}

/** Items of one feed's XML, newest first as the feed lists them. Exported for tests. */
export function parseFeed(xml, feed, max = 10) {
  const entries = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]).slice(0, max)
  return entries.map((e) => {
    const url = link(e)
    const date = text(tag(e, ['pubDate', 'published', 'updated', 'dc:date']))
    return {
      id: `blog:${feed.id}:${url.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')}`,
      source: 'blogs',
      title: text(tag(e, ['title'])),
      url,
      // the company name goes in front so interest matching and the AI both know whose announcement it is
      text: `Official ${feed.label} announcement. ${text(tag(e, ['description', 'summary', 'content:encoded', 'content'])).slice(0, 700)}`,
      publishedAt: date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
      signal: { blog: feed.label, company: feed.company }
    }
  }).filter((i) => i.title && i.url)
}

export async function poll(cfg) {
  const items = []
  const errors = []
  for (const feed of cfg.feeds) {
    try {
      const res = await fetch(feed.url, { headers: { 'user-agent': 'Briefly/1.0 (news digest; links back to every post)' }, signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      items.push(...parseFeed(await res.text(), feed, cfg.maxPerFeed))
    } catch (error) {
      errors.push(`${feed.label}: ${error.message}`)
    }
  }
  if (errors.length) console.log(`[poll] blogs: ${errors.length} feed(s) failed: ${errors.join('; ')}`)
  if (!items.length && errors.length) throw new Error(errors.join('; '))
  return items
}
