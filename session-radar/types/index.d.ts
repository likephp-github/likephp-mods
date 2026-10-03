export type Peer = {
  pid: number
  sessionId: string
  name: string
  status: string
  kind: string
  cwd: string
  since: number
}

export type Tiger = {
  isWorking: boolean
  /** 最近一次回覆結束的時間（毫秒）；0 表示從沒工作過。 */
  idleSince: number
  percent?: number
  frame: number
  x: number
  facing: 1 | -1
}

declare module 'claude-code' {
  interface PluginState {
    'session-radar': { peers: Peer[]; selfId: string; checkedAt: number; tiger: Tiger }
  }
}
