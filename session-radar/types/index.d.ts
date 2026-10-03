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
  /** 最近一次進入 resting 時抽的亂數（0 ≤ seed < 1），主題用來挑這段期間不變的內容（例如名言）。 */
  seed?: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-radar': { peers: Peer[]; selfId: string; checkedAt: number; tiger: Tiger }
  }
}
