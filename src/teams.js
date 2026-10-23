// Team workspaces. A team has its own interests, schedule, delivery and viaSocket connections: it is stored as a
// user record (id "t-…") so the whole pipeline serves it unchanged, plus a team record with owner, members and
// pending invitations (by account email; the invited person accepts after signing in).
import { randomUUID } from 'node:crypto'
import { load, save, putUser } from './store.js'
import { interests } from './config.js'

const err = (status, message) => Object.assign(new Error(message), { status })
const clean = (email) => String(email || '').trim().toLowerCase()

export const teamsOf = (accountId) => Object.values(load().teams).filter((t) => t.members.includes(accountId))
export const invitesFor = (email) => Object.values(load().teams).filter((t) => t.invites.includes(clean(email)))

export function createTeam(account, name) {
  name = String(name || '').trim().slice(0, 60)
  if (name.length < 2) throw err(400, 'Give the team a name.')
  const id = `t-${randomUUID()}`
  load().teams[id] = { id, name, owner: account.id, members: [account.id], invites: [], createdAt: new Date().toISOString() }
  putUser({ id, team: true, createdAt: new Date().toISOString(), onboarded: false, profile: { ...structuredClone(interests.defaults) }, connections: {}, delivery: { channel: null, fields: {}, ready: false } })
  return load().teams[id]
}

const ownedTeam = (account, id) => {
  const t = load().teams[id]
  if (!t) throw err(404, 'That team doesn’t exist.')
  if (t.owner !== account.id) throw err(403, 'Only the team owner can do that.')
  return t
}

export function invite(account, teamId, email, accountIdByEmail) {
  const t = ownedTeam(account, teamId)
  email = clean(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'Please enter a valid email address.')
  const existing = accountIdByEmail(email)
  if (existing && t.members.includes(existing)) throw err(409, 'They’re already in this team.')
  if (!t.invites.includes(email)) t.invites.push(email)
  save()
  return t
}

export function accept(account, teamId) {
  const t = load().teams[teamId]
  if (!t || !t.invites.includes(clean(account.email))) throw err(404, 'That invitation isn’t there any more.')
  t.invites = t.invites.filter((e) => e !== clean(account.email))
  if (!t.members.includes(account.id)) t.members.push(account.id)
  save()
  return t
}

export function decline(account, teamId) {
  const t = load().teams[teamId]
  if (t) { t.invites = t.invites.filter((e) => e !== clean(account.email)); save() }
}

export function removeMember(account, teamId, memberId) {
  const t = ownedTeam(account, teamId)
  if (memberId === t.owner) throw err(400, 'The owner can’t be removed. Delete the team instead.')
  t.members = t.members.filter((m) => m !== memberId)
  save()
}

export function cancelInvite(account, teamId, email) {
  const t = ownedTeam(account, teamId)
  t.invites = t.invites.filter((e) => e !== clean(email))
  save()
}

export function leave(account, teamId) {
  const t = load().teams[teamId]
  if (!t?.members.includes(account.id)) throw err(404, 'You’re not in that team.')
  if (t.owner === account.id) throw err(400, 'You own this team: delete it instead, or keep it.')
  t.members = t.members.filter((m) => m !== account.id)
  save()
}

/** Deletes the team and its workspace data. Returns the team's user record so its viaSocket flows can be paused. */
export function deleteTeam(account, teamId) {
  const t = ownedTeam(account, teamId)
  const d = load()
  const workspace = d.users[t.id]
  delete d.teams[t.id]
  delete d.users[t.id]
  delete d.userEvents[t.id]
  delete d.chats?.[t.id]
  save()
  return workspace
}
