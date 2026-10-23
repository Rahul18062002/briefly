// Storage: SQLite (Node's built-in node:sqlite), one file under DATA_DIR, which Embarko keeps across redeploys.
// The app works on plain objects in memory (load()); save() writes only the records that changed since the last
// save, in one transaction. Accounts and sessions live in their own tables (see auth.js), on the same database.
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url)) // a real path on Windows too
const FILE = process.env.BRIEFLY_DB || join(DIR, 'briefly.sqlite')
// the JSON file earlier versions used; imported once into an empty database
const LEGACY = process.env.BRIEFLY_IMPORT_JSON || join(DIR, 'db.json')
const RETENTION_DAYS = 45

// collection → how it is stored: a map of records, or one whole value
const MAPS = { users: 'user', items: 'item', events: 'event', userEvents: 'seen', chats: 'chat', teams: 'team' }
const SINGLES = { deliveries: [], sourceStatus: {} }

mkdirSync(dirname(FILE), { recursive: true })
export const sql = new DatabaseSync(FILE)
sql.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS docs (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id));
`)

let db = null
const written = new Map() // `${kind}\u0000${id}` → the JSON last written, to write only what changed

export function load() {
  if (db) return db
  db = { ...structuredClone(SINGLES) }
  for (const name of Object.keys(MAPS)) db[name] = {}
  const kindToName = Object.fromEntries(Object.entries(MAPS).map(([n, k]) => [k, n]))
  for (const row of sql.prepare('SELECT kind, id, json FROM docs').all()) {
    written.set(`${row.kind}\u0000${row.id}`, row.json)
    if (row.kind === 'meta') { if (row.id in SINGLES) db[row.id] = JSON.parse(row.json) }
    else if (kindToName[row.kind]) db[kindToName[row.kind]][row.id] = JSON.parse(row.json)
  }
  if (!written.size && existsSync(LEGACY)) {
    const old = JSON.parse(readFileSync(LEGACY, 'utf8'))
    for (const name of [...Object.keys(MAPS), ...Object.keys(SINGLES)]) if (old[name]) db[name] = old[name]
    save()
    console.log(`[store] imported ${Object.keys(db.users).length} users and ${Object.keys(db.events).length} stories from ${LEGACY}`)
  }
  return db
}

export function save() {
  if (!db) return
  const upsert = sql.prepare('INSERT INTO docs (kind, id, json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
  const remove = sql.prepare('DELETE FROM docs WHERE kind = ? AND id = ?')
  const now = new Date().toISOString()
  const present = new Set()
  const put = (kind, id, value) => {
    const key = `${kind}\u0000${id}`
    present.add(key)
    const json = JSON.stringify(value)
    if (written.get(key) !== json) { upsert.run(kind, id, json, now); written.set(key, json) }
  }
  sql.exec('BEGIN')
  try {
    for (const [name, kind] of Object.entries(MAPS)) for (const [id, value] of Object.entries(db[name] || {})) put(kind, id, value)
    for (const name of Object.keys(SINGLES)) put('meta', name, db[name])
    for (const key of [...written.keys()]) if (!present.has(key)) { const [kind, id] = key.split('\u0000'); remove.run(kind, id); written.delete(key) }
    sql.exec('COMMIT')
  } catch (error) {
    sql.exec('ROLLBACK')
    throw error
  }
}

/** Drops stories, items and per-user judgements older than the retention window, so the database stays small. */
export function prune(now = Date.now()) {
  const d = load()
  const cutoff = now - RETENTION_DAYS * 864e5
  const old = (iso) => iso && Date.parse(iso) < cutoff
  for (const [id, e] of Object.entries(d.events)) if (old(e.firstSeen)) delete d.events[id]
  for (const [id, i] of Object.entries(d.items)) if (old(i.fetchedAt)) delete d.items[id]
  for (const seen of Object.values(d.userEvents)) for (const [id, s] of Object.entries(seen)) if (!d.events[id] && old(s.at)) delete seen[id]
  save()
}

export function getUser(id) {
  return load().users[id]
}

export function putUser(user) {
  load().users[user.id] = user
  save()
  return user
}

export function userEvents(userId) {
  const all = load().userEvents
  return (all[userId] ??= {})
}
