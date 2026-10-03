export type Peer = {
  pid: number
  sessionId: string
  name: string
  status: string
  kind: string
  cwd: string
  since: number
  /** session 啟動時間（毫秒），用來給穩定的 hotkey 編號；缺少時為 0。 */
  startedAt: number
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
