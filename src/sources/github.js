// New releases of the configured repositories. The REST API gives notes and dates; when it is unreachable
// (rate limit, blocked network), the repository's public releases feed is read, then its tags over git.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)
// "v1.2.3", "1.2.3", "20250625" or "<repo>==1.2.3" → the bare version
const versionOf = (repo, tag) => tag.replace(new RegExp(`^(${repo.split('/')[1].replace(/[.-]/g, '\\$&')}(==|-|@))?v?`, 'i'), '')
const headers = { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }

async function viaApi(repo, cfg) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5`, { headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`GitHub API answered ${res.status}`)
  return (await res.json())
    .filter((r) => !r.draft && (cfg.includePrereleases || !r.prerelease))
    .slice(0, 1) // the newest only: two point releases a day apart are one piece of news
    .map((r) => ({
      id: `gh:${repo}@${r.tag_name}`,
      source: 'github',
      title: `${repo.split('/')[1]} ${versionOf(repo, r.tag_name)}${r.name && !r.name.includes(r.tag_name) ? `: ${r.name}` : ''} released`,
      url: r.html_url,
      text: (r.body || '').replace(/\r/g, '').slice(0, 1500),
      publishedAt: r.published_at,
      signal: { repo, tag: r.tag_name, version: versionOf(repo, r.tag_name) }
    }))
}

async function tagDate(repo, tag) {
  // A blobless, depth-1 fetch of the single tag: enough to read its commit date, a few KB.
  const dir = join(tmpdir(), `briefly-git-${process.pid}`)
  await run('git', ['init', '-q', '--bare', dir]).catch(() => {})
  await run('git', ['-C', dir, 'fetch', '-q', '--depth=1', '--filter=blob:none', `https://github.com/${repo}`, `refs/tags/${tag}`], { timeout: 30000 })
  const { stdout } = await run('git', ['-C', dir, 'log', '-1', '--format=%cI', 'FETCH_HEAD'])
  return stdout.trim()
}

async function viaGit(repo, cfg) {
  const { stdout } = await run('git', ['ls-remote', '--tags', '--refs', `https://github.com/${repo}`], { timeout: 30000 })
  // Other tag families (ci markers, sub-packages) are skipped.
  const tags = stdout.split('\n').map((l) => l.split('refs/tags/')[1]).filter(Boolean)
    .filter((t) => (cfg.includePrereleases ? /^\d+(\.\d+){1,3}/ : /^(\d+(\.\d+){1,3}|\d{8})$/).test(versionOf(repo, t)))
  const newest = tags.sort((a, b) => versionOf(repo, a).localeCompare(versionOf(repo, b), undefined, { numeric: true })).slice(-1)
  const items = []
  for (const tag of newest) {
    items.push({
      id: `gh:${repo}@${tag}`,
      source: 'github',
      title: `${repo.split('/')[1]} ${versionOf(repo, tag)} released`,
      url: `https://github.com/${repo}/releases/tag/${tag}`,
      text: '',
      publishedAt: await tagDate(repo, tag).catch(() => null),
      signal: { repo, tag, version: versionOf(repo, tag), via: 'git' }
    })
  }
  return items
}

// Every repository also publishes its releases as an Atom feed: no API quota and no git needed.
async function viaAtom(repo, cfg) {
  const res = await fetch(`https://github.com/${repo}/releases.atom`, { headers: { accept: 'application/atom+xml' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`releases feed answered ${res.status}`)
  const xml = await res.text()
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1])
  const unescape = (s = '') => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  for (const e of entries) {
    const link = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || ''
    const tag = decodeURIComponent(link.split('/releases/tag/')[1] || '')
    if (!tag || !(cfg.includePrereleases ? /^\d+(\.\d+){1,3}/ : /^(\d+(\.\d+){1,3}|\d{8})$/).test(versionOf(repo, tag))) continue
    const title = unescape((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || tag).trim()
    // the notes are HTML inside XML: unescaped once for the XML, tags dropped, then the HTML's own entities
    const notes = unescape(unescape((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '').replace(/<[^>]+>/g, ' '))
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\s+/g, ' ').trim()
    return [{
      id: `gh:${repo}@${tag}`,
      source: 'github',
      title: `${repo.split('/')[1]} ${versionOf(repo, tag)}${title && !title.includes(versionOf(repo, tag)) ? `: ${title}` : ''} released`,
      url: link,
      text: notes.slice(0, 1500),
      publishedAt: (e.match(/<updated>([^<]+)<\/updated>/) || [])[1] || null,
      signal: { repo, tag, version: versionOf(repo, tag), via: 'atom' }
    }]
  }
  return []
}

export async function poll(cfg) {
  const items = []
  const errors = []
  for (const repo of cfg.repos) {
    try {
      items.push(...(await viaApi(repo, cfg)))
    } catch (apiError) {
      // API refused (rate limit, blocked): the releases feed, then the tags over git
      try {
        items.push(...(await viaAtom(repo, cfg)))
      } catch (atomError) {
        try {
          items.push(...(await viaGit(repo, cfg)))
        } catch (gitError) {
          errors.push(`${repo}: API ${apiError.message}; feed ${atomError.message}; git ${gitError.message.split('\n')[0]}`)
        }
      }
    }
  }
  if (!items.length && errors.length) throw new Error(errors.join('; '))
  return items
}
