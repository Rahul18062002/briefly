import { readFileSync } from 'node:fs'

const load = (name) => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'))

export const interests = load('interests')
export const sources = load('sources')
export const engine = load('engine')
export const delivery = load('channels')
export const actions = load('actions')

export const channelById = (id) => delivery.channels.find((c) => c.id === id)
// every app a user may connect: delivery channels and one-click action targets, nothing else
export const allowedApps = [...new Set([...Object.keys(delivery.apps), ...actions.actions.map((a) => a.app)])]
export const appName = (slug) => delivery.apps[slug]?.name || actions.actions.find((a) => a.app === slug)?.appName || slug
export const tagById = (id) => interests.tags.find((t) => t.id === id)
export const companyById = (id) => interests.companies.find((c) => c.id === id)
