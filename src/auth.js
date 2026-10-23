// Accounts and sessions: email + password, hashed with scrypt; a random session token in an HttpOnly cookie,
// stored only as its SHA-256 hash. An account's id is the product's user id everywhere else (viaSocket included).
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { sql, load } from './store.js'

const SESSION_DAYS = 30
export const COOKIE = 'bf_session'

sql.exec(`
  CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, context TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
`)

const sha = (s) => createHash('sha256').update(s).digest('hex')
export function hashPassword(password) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`
}
export function checkPassword(password, stored) {
  const [, salt, hash] = String(stored).split('$')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

export const validEmail = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const publicAccount = (a) => a && { id: a.id, email: a.email, name: a.name }
export const accountByEmail = (email) => sql.prepare('SELECT * FROM accounts WHERE email = ?').get(String(email).trim())
export const accountById = (id) => sql.prepare('SELECT * FROM accounts WHERE id = ?').get(id)

/** A new account. An anonymous user from before login (same browser) becomes this account, keeping its data. */
export function signUp({ email, password, name }, anonymousId) {
  email = String(email || '').trim().toLowerCase()
  name = String(name || '').trim().slice(0, 80)
  if (!validEmail(email)) throw Object.assign(new Error('Please enter a valid email address.'), { status: 400 })
  if (typeof password !== 'string' || password.length < 8) throw Object.assign(new Error('Use a password of at least 8 characters.'), { status: 400 })
  if (accountByEmail(email)) throw Object.assign(new Error('An account with this email already exists. Sign in instead.'), { status: 409 })
  const claimable = anonymousId && load().users[anonymousId] && !accountById(anonymousId)
  const id = claimable ? anonymousId : `u-${randomUUID()}`
  sql.prepare('INSERT INTO accounts (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)').run(id, email, name || email.split('@')[0], hashPassword(password), new Date().toISOString())
  return publicAccount(accountById(id))
}

export function signIn({ email, password }) {
  const account = accountByEmail(String(email || '').trim())
  // the same answer for an unknown email and a wrong password
  if (!account || typeof password !== 'string' || !checkPassword(password, account.password)) throw Object.assign(new Error('That email and password don’t match.'), { status: 401 })
  return publicAccount(account)
}

export function createSession(accountId) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  sql.prepare('INSERT INTO sessions (token_hash, account_id, context, created_at, expires_at) VALUES (?, ?, NULL, ?, ?)')
    .run(sha(token), accountId, new Date(now).toISOString(), new Date(now + SESSION_DAYS * 864e5).toISOString())
  return token
}

export function sessionFor(token) {
  if (!token) return null
  const s = sql.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha(token))
  if (!s || Date.parse(s.expires_at) < Date.now()) return null
  const account = accountById(s.account_id)
  return account ? { tokenHash: s.token_hash, context: s.context, account: publicAccount(account) } : null
}

export const endSession = (token) => token && sql.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token))
export const setContext = (tokenHash, context) => sql.prepare('UPDATE sessions SET context = ? WHERE token_hash = ?').run(context, tokenHash)

export function changePassword(accountId, current, next) {
  const account = accountById(accountId)
  if (!account || !checkPassword(String(current || ''), account.password)) throw Object.assign(new Error('Your current password is not right.'), { status: 401 })
  if (typeof next !== 'string' || next.length < 8) throw Object.assign(new Error('Use a new password of at least 8 characters.'), { status: 400 })
  sql.prepare('UPDATE accounts SET password = ? WHERE id = ?').run(hashPassword(next), accountId)
}

// Simple brute-force guard: at most 10 failed sign-ins per email or address in 15 minutes.
const failures = new Map()
export function tooManyAttempts(...keys) {
  const now = Date.now()
  return keys.some((k) => (failures.get(k) || []).filter((t) => now - t < 15 * 60000).length >= 10)
}
export function noteFailure(...keys) {
  const now = Date.now()
  for (const k of keys) failures.set(k, [...(failures.get(k) || []).filter((t) => now - t < 15 * 60000), now])
}
