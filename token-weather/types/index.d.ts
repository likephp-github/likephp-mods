export type Reading = { percent: number; tokens: number; window: number }

export type Limit = { kind: string; percent: number; resetsAt?: string }

export type Info = {
  model: string
  project: string
  branch: string | null
  startedAt: number
  limits: Limit[]
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'token-weather': {
      readings: Reading[]
      isHidden: boolean
      info: Info | null
      now: number
    }
  }
}
