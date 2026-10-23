import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BRIEFLY_DB = ':memory:'; process.env.VIASOCKET_ORG_ID ||= 'test'; process.env.VIASOCKET_PROJECT_ID ||= 'test'; process.env.VIASOCKET_EMBED_SECRET ||= 'test'
const { parseReply, readEvent, recordSent, replyChannel, checkSecret } = await import('../src/replies.js')

test('reply commands', () => {
  assert.deepEqual(parseReply('explain 3'), { kind: 'explain', n: 3 })
  assert.deepEqual(parseReply('Tell me more about #2'), { kind: 'explain', n: 2 })
  assert.deepEqual(parseReply('more like 4'), { kind: 'vote', vote: 1, n: 4 })
  assert.deepEqual(parseReply('👎'), { kind: 'vote', vote: -1, n: 1 })
  assert.deepEqual(parseReply('save 5'), { kind: 'save', n: 5 })
  assert.deepEqual(parseReply('What did OpenAI ship?'), { kind: 'ask', question: 'What did OpenAI ship?' })
  assert.equal(parseReply('   '), null)
})

test('a real Discord event (from viaSocket sampleEvent) is read correctly; Briefly ignores its own posts', () => {
  const real = { type: 0, content: '**openai-python 3.36.1 released**', id: '1562792586844966913', channel_id: '1562790208166953100', author: { id: '1', username: 'TechPulse', bot: true }, webhook_id: '1562792570583650466' }
  assert.deepEqual(readEvent('discord', { event: real }), { text: real.content, fromBot: true, channel: '1562790208166953100', parentKey: null })
  const human = { ...real, content: 'explain 2', author: { id: '9', username: 'rahul' }, webhook_id: undefined, message_reference: { message_id: '1562792586844966913' } }
  assert.deepEqual(readEvent('discord', { event: human }), { text: 'explain 2', fromBot: false, channel: '1562790208166953100', parentKey: 'discord:1562792586844966913' })
})

test('sent messages are remembered by their real result shape (Slack ts, Discord id)', () => {
  const user = {}
  recordSent(user, [{ ok: true, channel: 'C0A5AN3GDTP', ts: '1792672367.038759' }], ['e1', 'e2'])
  recordSent(user, [{ type: 0, id: '1562792586844966913', channel_id: '1562790208166953100' }], ['e3'])
  recordSent(user, [{ id: '1a16334900dbc727', threadId: '1a16334900dbc727' }], ['e4']) // Gmail: nothing to reply to
  assert.deepEqual(user.sentMessages.map((m) => m.key), ['discord:1562792586844966913', 'slack:C0A5AN3GDTP:1792672367.038759'])
  assert.deepEqual(user.sentMessages[1].eventIds, ['e1', 'e2'])
})

test('which channel replies come from, and the secret check', () => {
  assert.deepEqual(replyChannel({ delivery: { channel: 'discord_channel', fields: { channel_id: '42' } } }), { app: 'discord', channel: '42' })
  assert.deepEqual(replyChannel({ delivery: { channel: 'slack_channel', fields: { 'destination.channel_id': ['C1'] } } }), { app: 'slack', channel: 'C1' })
  assert.equal(replyChannel({ delivery: { channel: 'gmail', fields: {} } }), null)
  assert.equal(checkSecret({ replies: {} }, 'Bearer x'), false)
})

test('a real Slack thread reply (from viaSocket sampleEvent, org 4160) is read correctly', () => {
  const real = { token: null, team_id: 'T082ACF6L9J', type: 'event_callback', event: { user: 'U0A6THCVAH1', type: 'message', ts: '1785577604.842049', text: 'test', team: 'T082ACF6L9J', thread_ts: '1785577450.519559', parent_user_id: 'U0A6THCVAH1', channel: 'C07DZ9UG46S', event_ts: '1785577604.842049', channel_type: 'channel' } }
  // the handler forwards it as { event: context.req.body }
  assert.deepEqual(readEvent('slack', { event: real }), { text: 'test', fromBot: false, channel: 'C07DZ9UG46S', threadTs: '1785577450.519559', parentKey: 'slack:C07DZ9UG46S:1785577450.519559' })
  assert.equal(readEvent('slack', { event: { ...real, event: { ...real.event, bot_id: 'B1' } } }).fromBot, true)
})

test('a test message is remembered as a test, so a reply to it gets a clear answer', () => {
  const user = {}
  recordSent(user, [{ ok: true, channel: 'C1', ts: '1.2' }], [], { test: true })
  assert.equal(user.sentMessages[0].key, 'slack:C1:1.2')
  assert.equal(user.sentMessages[0].test, true)
})
