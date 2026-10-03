/**
 * 跳到某個 session 所在的終端機：依它的 tty 依序問 tmux、iTerm2、Terminal.app。
 * 外部指令一律透過注入的 run 執行（argv，不經 shell），方便用假結果測試。
 */

export type RunResult = { exitCode: number; stdout: string; stderr: string }
export type Run = (argv: readonly string[]) => Promise<RunResult>

export type Outcome =
  | { kind: 'done' }
  | { kind: 'notFound' }
  | { kind: 'attach'; session: string }
  | { kind: 'denied'; app: string }
  | { kind: 'error'; detail: string }

/** 依序詢問的終端機 app（AppleScript 名稱）。 */
const APPS = ['iTerm2', 'Terminal'] as const
type App = (typeof APPS)[number]

/** 在 app 裡找 tty 相符的分頁，選取後帶到最前面；找到回 "found"。tty 由 argv 傳入。 */
const FOCUS: Record<App, string[]> = {
  iTerm2: [
    'on run argv',
    'tell application "iTerm2"',
    'repeat with w in windows',
    'repeat with t in tabs of w',
    'repeat with s in sessions of t',
    'if tty of s is (item 1 of argv) then',
    'select w',
    'tell t to select',
    'tell s to select',
    'activate',
    'return "found"',
    'end if',
    'end repeat',
    'end repeat',
    'end repeat',
    'end tell',
    'return ""',
    'end run',
  ],
  Terminal: [
    'on run argv',
    'tell application "Terminal"',
    'repeat with w in windows',
    'repeat with t in tabs of w',
    'if tty of t is (item 1 of argv) then',
    'set selected of t to true',
    'set index of w to 1',
    'activate',
    'return "found"',
    'end if',
    'end repeat',
    'end repeat',
    'end tell',
    'return ""',
    'end run',
  ],
}

const script = (lines: readonly string[]): string[] => lines.flatMap(line => ['-e', line])

/** macOS 拒絕 Apple events（使用者沒允許自動化）的錯誤碼。 */
const NOT_AUTHORIZED = '-1743'

/** ps 輸出的 tty（ttys001）轉成 /dev/ttys001；沒有終端機（??）回 undefined。 */
export const ttyOf = (psOut: string): string | undefined => {
  const name = psOut.trim()
  if (name === '' || name.startsWith('?')) return undefined
  return name.startsWith('/dev/') ? name : `/dev/${name}`
}

type Pane = { tty: string; session: string; window: string; pane: string }

const PANE_FORMAT = '#{pane_tty} #{session_name} #{window_id} #{pane_id}'

/** 解析 tmux list-panes -a 的輸出（欄位見 PANE_FORMAT）。session 名稱可能含空白。 */
export const parsePanes = (out: string): Pane[] =>
  out
    .split('\n')
    .map(line => line.trim().split(' '))
    .filter(parts => parts.length >= 4)
    .map(parts => ({
      tty: parts[0] ?? '',
      session: parts.slice(1, -2).join(' '),
      window: parts.at(-2) ?? '',
      pane: parts.at(-1) ?? '',
    }))

/** 依序問正在執行的終端機 app；沒找到回 undefined。 */
const focusTty = async (run: Run, tty: string): Promise<Outcome | undefined> => {
  for (const app of APPS) {
    const running = await run(['osascript', '-e', `application "${app}" is running`])
    if (running.stdout.trim() !== 'true') continue
    const found = await run(['osascript', ...script(FOCUS[app]), tty])
    if (found.stderr.includes(NOT_AUTHORIZED)) return { kind: 'denied', app }
    if (found.exitCode !== 0) return { kind: 'error', detail: found.stderr.trim() }
    if (found.stdout.trim() === 'found') return { kind: 'done' }
  }
  return undefined
}

/** 目標在 tmux 裡：選到它的 pane，再把看得到它的畫面帶到前面。 */
const jumpInTmux = async (run: Run, target: Pane, inTmux: boolean): Promise<Outcome> => {
  for (const argv of [
    ['tmux', 'select-window', '-t', target.window],
    ['tmux', 'select-pane', '-t', target.pane],
  ]) {
    const r = await run(argv)
    if (r.exitCode !== 0) return { kind: 'error', detail: r.stderr.trim() }
  }
  const clients = await run(['tmux', 'list-clients', '-t', target.session, '-F', '#{client_tty}'])
  const client = clients.exitCode === 0 ? ttyOf(clients.stdout.split('\n')[0] ?? '') : undefined
  if (client !== undefined) return (await focusTty(run, client)) ?? { kind: 'notFound' }
  if (!inTmux) return { kind: 'attach', session: target.session }
  const r = await run(['tmux', 'switch-client', '-t', target.pane])
  return r.exitCode === 0 ? { kind: 'done' } : { kind: 'error', detail: r.stderr.trim() }
}

/** 跳到 pid 這個 session 所在的終端機。inTmux：本視窗是否在 tmux 裡。 */
export const jumpTo = async (pid: number, run: Run, env: { inTmux: boolean }): Promise<Outcome> => {
  try {
    const ps = await run(['ps', '-o', 'tty=', '-p', String(pid)])
    const tty = ps.exitCode === 0 ? ttyOf(ps.stdout) : undefined
    if (tty === undefined) return { kind: 'notFound' }

    // 沒裝 tmux 時指令根本無法啟動，當成 tmux 裡找不到
    const panes = await run(['tmux', 'list-panes', '-a', '-F', PANE_FORMAT]).catch(() => ({ exitCode: 1, stdout: '', stderr: '' }))
    const target = panes.exitCode === 0 ? parsePanes(panes.stdout).find(p => p.tty === tty) : undefined
    if (target !== undefined) return await jumpInTmux(run, target, env.inTmux)

    return (await focusTty(run, tty)) ?? { kind: 'notFound' }
  } catch (err) {
    return { kind: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}

/** 給使用者看的提示；成功時不提示。 */
export const messageFor = (o: Outcome): string | undefined => {
  switch (o.kind) {
    case 'done':
      return undefined
    case 'notFound':
      return '找不到這個 session 所在的終端機（支援 tmux、iTerm2、Terminal.app）'
    case 'attach':
      return `這個 session 在未連線的 tmux session「${o.session}」，請執行 tmux attach -t ${o.session}`
    case 'denied':
      return `沒有控制 ${o.app} 的權限，請到「系統設定 › 隱私權與安全性 › 自動化」允許`
    case 'error':
      return `切換失敗：${o.detail.split('\n')[0] ?? ''}`
  }
}
