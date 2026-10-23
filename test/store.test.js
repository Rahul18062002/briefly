// The SQLite store, on temporary files: imports an old db.json once, writes only changes, reloads the same data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const dir = mkdtempSync(join(tmpdir(), 'briefly-store-'))
const run = (code) => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', code], {
  env: { ...process.env, DATA_DIR: dir, BRIEFLY_DB: '', BRIEFLY_IMPORT_JSON: '' }, cwd: new URL('..', import.meta.url), encoding: 'utf8'
}).trim()

test('imports the old JSON file once, saves changes, and reloads them after a restart', () => {
  writeFileSync(join(dir, 'db.json'), JSON.stringify({ users: { u1: { id: 'u1', profile: { tags: ['llms'] } } }, events: { e1: { id: 'e1', title: 'Hello', firstSeen: new Date().toISOString() } }, userEvents: { u1: { e1: { status: 'queued' } } }, deliveries: [{ ok: true }] }))
  const first = run(`import { load, putUser, userEvents, save } from './src/store.js'
    const d = load(); putUser({ ...d.users.u1, onboarded: true }); userEvents('u1').e1.vote = 1; save()
    console.log(Object.keys(d.events).length, d.deliveries.length)`)
  assert.match(first, /1 1$/)
  // a "restart": a new process reads the database, not the JSON file
  writeFileSync(join(dir, 'db.json'), '{}')
  const second = run(`import { load } from './src/store.js'
    const d = load(); console.log(JSON.stringify([d.users.u1.onboarded, d.userEvents.u1.e1.vote, d.events.e1.title]))`)
  assert.equal(second, '[true,1,"Hello"]')
})

test('old stories are pruned; recent ones stay', () => {
  const out = run(`import { load, prune, save } from './src/store.js'
    const d = load()
    d.events.old = { id: 'old', title: 'Old', firstSeen: '2020-01-01T00:00:00Z' }
    d.events.new = { id: 'new', title: 'New', firstSeen: new Date().toISOString() }
    save(); prune()
    console.log(Object.keys(d.events).sort().join(','))`)
  assert.ok(!out.split(',').includes('old') && out.split(',').includes('new'))
})
