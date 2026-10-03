import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { THEME_NAMES } from './choice'
import { DEFAULT_THEME } from './theme'

/** 測試裡回答 $ 呼叫的 hook 要回 { value }，型別上沒有這一層，只好轉型。 */
const answer = (value: unknown) => ({ value }) as never

// 測試裡沒有設定 HOME，家目錄是空字串
const SETTINGS = '/.claude/session-radar.json'

/** 預設主題在登錄表中的下一個，也就是沒有設定檔時 /sessions theme 會換到的主題。 */
const AFTER_DEFAULT = THEME_NAMES[(THEME_NAMES.indexOf(DEFAULT_THEME) + 1) % THEME_NAMES.length]
const LAST = THEME_NAMES[THEME_NAMES.length - 1]

/** 假的檔案系統：只有 files 裡的檔案讀得到，寫入記在 files。 */
const fakeFs = (on: On, files: Record<string, string>) => {
  on('fs.read', async (_$, e) => {
    const text = files[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return answer(text)
  })
  on('fs.write', async (_$, e) => {
    files[e.path] = e.text
    return answer(undefined)
  })
  on('fs.list', async () => answer([]))
}

/** 讓 session.start 跑得完：回答它用到的 $ 呼叫。 */
const startSession = async ($: Engine, on: On) => {
  mock.clock(on, { now: 1 })
  mock.env(on, {})
  on('session.id', async () => answer('me'))
  on('command.register', async () => answer(undefined))
  on('session.usage', async () => answer({ context: {} }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/x', surface: 'terminal', isInteractive: true })
}

/** 像使用者在提示列輸入 /sessions <args>，回傳回覆文字。 */
const sessions = async ($: Engine, args: string) =>
  (
    await $.command.run({
      command: 'sessions',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
  ).text

test('/sessions theme 輪流換到下一個主題並寫進設定檔，保留其他欄位', async ($, on) => {
  const files: Record<string, string> = { [SETTINGS]: '{ "other": 1 }' }
  fakeFs(on, files)
  expect(await sessions($, 'theme')).toBe(`主題已切換為 ${AFTER_DEFAULT}。`)
  expect(JSON.parse(files[SETTINGS] ?? '')).toEqual({ other: 1, theme: AFTER_DEFAULT })
})

test('/sessions theme <名稱> 指定主題並寫進設定檔', async ($, on) => {
  const files: Record<string, string> = {}
  fakeFs(on, files)
  expect(await sessions($, ` theme  ${LAST} `)).toBe(`主題已切換為 ${LAST}。`)
  expect(JSON.parse(files[SETTINGS] ?? '')).toEqual({ theme: LAST })
})

test('/sessions theme 不認得的名稱回可用清單，不改主題也不寫檔', async ($, on) => {
  const files: Record<string, string> = {}
  fakeFs(on, files)
  expect(await sessions($, 'theme xyz')).toBe(`沒有「xyz」這個主題；可用的主題：${THEME_NAMES.join('、')}。`)
  expect(files[SETTINGS]).toBeUndefined()
  // 主題沒變：接著輪流仍是從預設主題往下一個
  expect(await sessions($, 'theme')).toBe(`主題已切換為 ${AFTER_DEFAULT}。`)
})

test('寫檔失敗時仍切換，並告訴使用者只在這個 session 有效', async ($, on) => {
  on('fs.read', async () => {
    throw new Error('ENOENT')
  })
  on('fs.write', async () => {
    throw new Error('EACCES')
  })
  expect(await sessions($, `theme ${DEFAULT_THEME}`)).toBe(`主題已切換為 ${DEFAULT_THEME}（設定檔寫入失敗，只在這個 session 有效）。`)
})

test('/sessions 其他參數仍顯示用法，用法提到 theme', async ($, on) => {
  fakeFs(on, {})
  expect(await sessions($, 'abc')).toContain('/sessions theme')
})

test('啟動時讀設定檔的主題：之後從它輪流到下一個', async ($, on) => {
  fakeFs(on, { [SETTINGS]: `{ "theme": "${LAST}" }` })
  await startSession($, on)
  expect(await sessions($, 'theme')).toBe(`主題已切換為 ${THEME_NAMES[0]}。`)
})

for (const [what, files] of [
  ['設定檔不存在', {}],
  ['設定檔壞掉', { [SETTINGS]: '{ "theme": "pu' }],
  ['設定檔的主題不認得', { [SETTINGS]: '{ "theme": "xyz" }' }],
] as const) {
  test(`啟動時${what}就用預設主題，不報錯`, async ($, on) => {
    fakeFs(on, { ...files })
    await startSession($, on)
    expect(await sessions($, 'theme')).toBe(`主題已切換為 ${AFTER_DEFAULT}。`)
  })
}
