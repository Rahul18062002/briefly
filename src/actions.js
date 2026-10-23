// One-click actions: send a story to another app the user connected (Google Sheets first), through viaSocket.
// Where each inputData key comes from: the user picks the spreadsheet and sheet once (PICK keys); the story fills
// the row each time; use_json_rows is a constant (true), the right way to pass one row for every user.
import { viasocket, serviceIdFor } from './viasocket.js'
import { actions } from './config.js'
import { ensureEnabled, isFailure } from './delivery.js'

export const actionById = (id) => actions.actions.find((a) => a.id === id)

export function storyRow(event, ai) {
  return {
    Date: new Date().toISOString().slice(0, 10),
    Headline: ai?.headline || event.title,
    Topic: ai?.topic || '',
    Summary: ai?.summary || '',
    Link: event.url,
    Source: (event.sources || []).join(', ')
  }
}

export function inputFor(def, fields, event, ai) {
  if (def.app === 'google-sheets')
    return { spreadSheet_Id: fields.spreadSheet_Id, sheet_id: fields.sheet_id, use_json_rows: true, rows_json: JSON.stringify([storyRow(event, ai)]) }
  throw new Error(`No input for ${def.app}`)
}

/** Choices for one PICK key, scoped by the earlier choices (a sheet depends on its spreadsheet). */
export async function actionOptions(user, actionId, fieldKey, existing = {}, searchText) {
  const def = actionById(actionId)
  const pick = def?.pick.find((p) => p.key === fieldKey)
  if (!pick) throw new Error('Unknown field')
  const authId = user.connections?.[def.app]?.authId
  if (!authId) throw new Error(`Connect ${def.appName} first`)
  const existingFields = {}
  if (pick.after) existingFields[pick.after] = existing[pick.after]
  if (searchText) existingFields._searchText = searchText
  const actionVersionId = await viasocket.catalog.versionIdFor(await serviceIdFor(def.app), def.action, def.version)
  return viasocket.user(user.id).listOptions(actionVersionId, { fieldKey, authId, existingFields })
}

export async function runStoryAction(user, actionId, event, ai) {
  const def = actionById(actionId)
  const target = user.saveTargets?.[actionId]
  if (!def || !target) throw Object.assign(new Error('Choose where to save first (Delivery page).'), { status: 400 })
  const scriptId = await ensureEnabled(user, def.app)
  const actionVersionId = await viasocket.catalog.versionIdFor(await serviceIdFor(def.app), def.action, def.version)
  const out = await viasocket.runAction(scriptId, actionVersionId, inputFor(def, target.fields, event, ai))
  if (isFailure(out)) throw Object.assign(new Error(out.message || out.data?.message || `${def.appName} refused the row`), { status: 502 })
  return out
}
