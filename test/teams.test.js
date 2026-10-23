import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BRIEFLY_DB = ':memory:'
const { createTeam, invite, accept, leave, removeMember, deleteTeam, teamsOf, invitesFor } = await import('../src/teams.js')
const { load } = await import('../src/store.js')

const owner = { id: 'u-owner', email: 'owner@x.com' }, sam = { id: 'u-sam', email: 'sam@x.com' }, eve = { id: 'u-eve', email: 'eve@x.com' }
const byEmail = (e) => ({ 'owner@x.com': 'u-owner', 'sam@x.com': 'u-sam' })[e]

test('create a team, invite by email, accept, leave, remove, delete', () => {
  const t = createTeam(owner, 'Research club')
  assert.equal(load().users[t.id].team, true) // the team has its own workspace (interests, delivery, connections)
  invite(owner, t.id, 'Sam@X.com', byEmail)
  assert.deepEqual(invitesFor('sam@x.com').map((x) => x.id), [t.id])
  assert.throws(() => invite(sam, t.id, 'eve@x.com', byEmail), /Only the team owner/)
  accept(sam, t.id)
  assert.deepEqual(teamsOf('u-sam').map((x) => x.name), ['Research club'])
  assert.throws(() => accept(eve, t.id), /isn’t there/)
  assert.throws(() => leave(owner, t.id), /delete it instead/)
  leave(sam, t.id)
  assert.deepEqual(teamsOf('u-sam'), [])
  invite(owner, t.id, 'sam@x.com', byEmail); accept(sam, t.id)
  assert.throws(() => removeMember(sam, t.id, 'u-owner'), /Only the team owner/)
  removeMember(owner, t.id, 'u-sam')
  assert.deepEqual(load().teams[t.id].members, ['u-owner'])
  deleteTeam(owner, t.id)
  assert.equal(load().teams[t.id], undefined)
  assert.equal(load().users[t.id], undefined)
})
