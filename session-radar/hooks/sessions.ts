import type { Peer } from '../types'

export type Look = { icon: string; label: string; color: string }

const LOOKS: Record<string, Look> = {
  busy: { icon: '●', label: '工作中', color: 'yellow' },
  idle: { icon: '○', label: '閒置', color: 'green' },
  shell: { icon: '◆', label: 'shell', color: 'cyan' },
  waiting: { icon: '◐', label: '等待回應', color: 'magenta' },
}

export const look = (status: string): Look =>
  LOOKS[status] ?? { icon: '·', label: status || '未知', color: 'gray' }

const asString = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)
const asNumber = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback)

/** 解析 ~/.claude/sessions/<pid>.json；格式不符（例如寫入到一半）回 undefined。 */
export const parsePeer = (text: string): Peer | undefined => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const d = raw as Record<string, unknown>
  if (typeof d.pid !== 'number' || typeof d.sessionId !== 'string') return undefined

  return {
    pid: d.pid,
    sessionId: d.sessionId,
    name: asString(d.name, `pid ${d.pid}`),
    status: asString(d.status, ''),
    kind: asString(d.kind, ''),
    cwd: asString(d.cwd, ''),
    since: asNumber(d.statusUpdatedAt, asNumber(d.updatedAt, asNumber(d.startedAt, 0))),
    startedAt: asNumber(d.startedAt, 0),
  }
}

/** 工作中的排最前面，其次依最近狀態變動時間。 */
export const sortPeers = (peers: readonly Peer[]): Peer[] =>
  [...peers].sort((a, b) => {
    const busy = Number(b.status === 'busy') - Number(a.status === 'busy')
    return busy !== 0 ? busy : b.since - a.since
  })

/**
 * 本視窗以外的 session 依啟動時間由舊到新編號 1～9，當作 hotkey。
 * 與清單排序無關，session 還在時編號就不變。
 */
export const hotkeys = (peers: readonly Peer[], selfId: string): Record<string, string> =>
  Object.fromEntries(
    peers
      .filter(p => p.sessionId !== selfId)
      .sort((a, b) => a.startedAt - b.startedAt || a.pid - b.pid)
      .slice(0, 9)
      .map((p, i) => [p.sessionId, String(i + 1)]),
  )

/** 依 hotkey 編號找回 session。 */
export const peerForKey = (peers: readonly Peer[], selfId: string, key: string): Peer | undefined => {
  const keys = hotkeys(peers, selfId)
  return peers.find(p => keys[p.sessionId] === key)
}

export type SessionsCommand =
  | { kind: 'toggle' }
  | { kind: 'jump'; key: string }
  | { kind: 'theme'; name?: string }
  | { kind: 'usage' }

/** /sessions 的參數：空的開關面板，1～9 跳到該編號的 session，theme [名稱] 切換主題（名稱由呼叫端檢查）。 */
export const parseSessionsArgs = (args: string): SessionsCommand => {
  const a = args.trim()
  if (a === '') return { kind: 'toggle' }
  if (/^[1-9]$/.test(a)) return { kind: 'jump', key: a }
  const theme = /^theme(?:\s+(\S+))?$/.exec(a)
  if (theme === null) return { kind: 'usage' }
  return theme[1] === undefined ? { kind: 'theme' } : { kind: 'theme', name: theme[1] }
}

export const ago = (since: number, now: number): string => {
  const s = Math.max(0, Math.round((now - since) / 1000))
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時`
  return `${Math.floor(h / 24)}天`
}

