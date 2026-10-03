import { describe, expect, test } from 'claude-code/testing'

import { jumpTo, messageFor } from './jump'
import type { RunResult } from './jump'

const ok = (stdout = ''): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const fail = (stderr = ''): RunResult => ({ exitCode: 1, stdout: '', stderr })

/** 依指令開頭回應的假執行器，記下每次呼叫。 */
const fake = (answers: { match: (argv: readonly string[]) => boolean; result: RunResult }[]) => {
  const calls: string[][] = []
  const run = async (argv: readonly string[]) => {
    calls.push([...argv])
    return answers.find(a => a.match(argv))?.result ?? fail('unexpected')
  }
  return { run, calls }
}

const isPs = (a: readonly string[]) => a[0] === 'ps'
const isTmux = (sub: string) => (a: readonly string[]) => a[0] === 'tmux' && a[1] === sub
const isRunning = (app: string) => (a: readonly string[]) => a[0] === 'osascript' && a.join(' ').includes(`application "${app}" is running`)
const isFocus = (app: string) => (a: readonly string[]) => a[0] === 'osascript' && a.join(' ').includes(`tell application "${app}"`)

const PANES = '/dev/ttys009 work @3 %7\n/dev/ttys004 other @1 %2\n'

describe('找不到 tty', () => {
  test('ps 失敗就找不到', async () => {
    const { run } = fake([{ match: isPs, result: fail() }])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'notFound' })
  })
  test('沒有終端機（??）就找不到', async () => {
    const { run } = fake([{ match: isPs, result: ok('??\n') }])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'notFound' })
  })
})

describe('tmux', () => {
  test('有 client 連著：選取 pane 後到 iTerm2 找 client 的分頁', async () => {
    const { run, calls } = fake([
      { match: isPs, result: ok('ttys009\n') },
      { match: isTmux('list-panes'), result: ok(PANES) },
      { match: isTmux('select-window'), result: ok() },
      { match: isTmux('select-pane'), result: ok() },
      { match: isTmux('list-clients'), result: ok('/dev/ttys001\n') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: ok('found\n') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'done' })
    expect(calls.some(c => c[1] === 'select-pane' && c.includes('%7'))).toBe(true)
    expect(calls.find(isFocus('iTerm2'))?.at(-1)).toBe('/dev/ttys001')
  })
  test('沒有 client、本視窗在 tmux：switch-client 到目標 pane', async () => {
    const { run, calls } = fake([
      { match: isPs, result: ok('ttys009\n') },
      { match: isTmux('list-panes'), result: ok(PANES) },
      { match: isTmux('select-window'), result: ok() },
      { match: isTmux('select-pane'), result: ok() },
      { match: isTmux('list-clients'), result: ok('') },
      { match: isTmux('switch-client'), result: ok() },
    ])
    expect(await jumpTo(1, run, { inTmux: true })).toEqual({ kind: 'done' })
    expect(calls.find(isTmux('switch-client'))).toContain('%7')
  })
  test('沒有 client、本視窗不在 tmux：提示 attach，不跑 AppleScript', async () => {
    const { run, calls } = fake([
      { match: isPs, result: ok('ttys009\n') },
      { match: isTmux('list-panes'), result: ok(PANES) },
      { match: isTmux('select-window'), result: ok() },
      { match: isTmux('select-pane'), result: ok() },
      { match: isTmux('list-clients'), result: ok('') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'attach', session: 'work' })
    expect(calls.some(c => c[0] === 'osascript')).toBe(false)
  })
  test('tmux 沒在跑就改問終端機', async () => {
    const { run } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isTmux('list-panes'), result: fail('no server running') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: ok('found\n') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'done' })
  })
})

describe('沒裝 tmux', () => {
  test('tmux 指令無法執行時改問終端機', async () => {
    const { run: base } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: ok('found\n') },
    ])
    const run = async (argv: readonly string[]) => {
      if (argv[0] === 'tmux') throw new Error('command not found: tmux')
      return base(argv)
    }
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'done' })
  })
})

describe('終端機 app', () => {
  test('iTerm2 找不到就問 Terminal.app', async () => {
    const { run } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isTmux('list-panes'), result: ok('') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: ok('\n') },
      { match: isRunning('Terminal'), result: ok('true\n') },
      { match: isFocus('Terminal'), result: ok('found\n') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'done' })
  })
  test('沒在執行的 app 不會被詢問', async () => {
    const { run, calls } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isTmux('list-panes'), result: ok('') },
      { match: isRunning('iTerm2'), result: ok('false\n') },
      { match: isRunning('Terminal'), result: ok('false\n') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'notFound' })
    expect(calls.some(c => isFocus('iTerm2')(c) || isFocus('Terminal')(c))).toBe(false)
  })
  test('權限被拒（-1743）', async () => {
    const { run } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isTmux('list-panes'), result: ok('') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: fail('execution error: Not authorized to send Apple events to iTerm2. (-1743)') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'denied', app: 'iTerm2' })
  })
  test('其他錯誤保留完整訊息', async () => {
    const { run } = fake([
      { match: isPs, result: ok('ttys001\n') },
      { match: isTmux('list-panes'), result: ok('') },
      { match: isRunning('iTerm2'), result: ok('true\n') },
      { match: isFocus('iTerm2'), result: fail('syntax error (-2741)') },
    ])
    expect(await jumpTo(1, run, { inTmux: false })).toEqual({ kind: 'error', detail: 'syntax error (-2741)' })
  })
  test('執行器丟例外時回報錯誤', async () => {
    const run = async () => {
      throw new Error('boom')
    }
    expect((await jumpTo(1, run, { inTmux: false })).kind).toBe('error')
  })
})

describe('提示文字', () => {
  test('成功不提示', async () => {
    expect(messageFor({ kind: 'done' })).toBeUndefined()
  })
  test('權限被拒時指向自動化設定', async () => {
    expect(messageFor({ kind: 'denied', app: 'iTerm2' })).toContain('系統設定 › 隱私權與安全性 › 自動化')
  })
  test('detached 時提示 attach 指令', async () => {
    expect(messageFor({ kind: 'attach', session: 'work' })).toContain('tmux attach -t work')
  })
  test('找不到時說找不到', async () => {
    expect(messageFor({ kind: 'notFound' })).toContain('找不到')
  })
})
