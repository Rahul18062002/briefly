import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BRIEFLY_DB = ':memory:'
const { signUp, signIn, createSession, sessionFor, endSession, hashPassword, checkPassword } = await import('../src/auth.js')

test('passwords are stored as salted scrypt hashes and checked in constant time', () => {
  const a = hashPassword('correct horse'), b = hashPassword('correct horse')
  assert.notEqual(a, b) // different salt every time
  assert.ok(a.startsWith('scrypt$') && !a.includes('correct horse'))
  assert.equal(checkPassword('correct horse', a), true)
  assert.equal(checkPassword('wrong horse', a), false)
})

test('sign up, sign in (any case of email), sessions, sign out', () => {
  const acc = signUp({ email: 'Sam@Example.com', password: 'long enough', name: 'Sam' })
  assert.equal(acc.email, 'sam@example.com')
  assert.throws(() => signUp({ email: 'sam@example.com', password: 'another one' }), /already exists/)
  assert.throws(() => signUp({ email: 'not-an-email', password: 'long enough' }), /valid email/)
  assert.throws(() => signIn({ email: 'sam@example.com', password: 'wrong pass' }), /don’t match/)
  assert.throws(() => signIn({ email: 'nobody@example.com', password: 'whatever1' }), /don’t match/) // same answer
  assert.equal(signIn({ email: 'SAM@example.com', password: 'long enough' }).id, acc.id)
  const token = createSession(acc.id)
  assert.equal(sessionFor(token).account.email, 'sam@example.com')
  assert.equal(sessionFor('forged-token'), null)
  endSession(token)
  assert.equal(sessionFor(token), null)
})
