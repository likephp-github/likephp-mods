import { describe, expect, test } from 'claude-code/testing'

import { ago, hotkeys, look, parsePeer, parseSessionsArgs, peerForKey, sortPeers } from './sessions'

const peer = (status: string, since: number) => ({
  pid: since,
  sessionId: `s${since}`,
  name: `n${since}`,
  status,
  kind: 'interactive',
  cwd: '/x',
  since,
  startedAt: since,
})

describe('parsePeer', () => {
  test('讀出名稱與狀態', async () => {
    const p = parsePeer('{"pid":1,"sessionId":"a","name":"ems-d8","status":"idle","statusUpdatedAt":5}')
    expect(p?.name).toBe('ems-d8')
  })
  test('沒有 statusUpdatedAt 時退回 updatedAt', async () => {
    expect(parsePeer('{"pid":1,"sessionId":"a","updatedAt":9}')?.since).toBe(9)
  })
  test('寫到一半的 JSON 回 undefined', async () => {
    expect(parsePeer('{"pid":1,"sess')).toBeUndefined()
  })
  test('讀出啟動時間', async () => {
    expect(parsePeer('{"pid":1,"sessionId":"a","startedAt":42}')?.startedAt).toBe(42)
  })
  test('缺啟動時間時當成 0', async () => {
    expect(parsePeer('{"pid":1,"sessionId":"a"}')?.startedAt).toBe(0)
  })
  test('缺 sessionId 回 undefined', async () => {
    expect(parsePeer('{"pid":1}')).toBeUndefined()
  })
})

describe('顯示', () => {
  test('工作中排最前面', async () => {
    expect(sortPeers([peer('idle', 9), peer('busy', 1)])[0]?.status).toBe('busy')
  })
  test('同狀態依最近變動排序', async () => {
    expect(sortPeers([peer('idle', 1), peer('idle', 9)])[0]?.since).toBe(9)
  })
  test('未知狀態顯示原字串', async () => {
    expect(look('compacting').label).toBe('compacting')
  })
  test('相對時間以分鐘顯示', async () => {
    expect(ago(0, 125_000)).toBe('2分')
  })
})

describe('hotkey 編號', () => {
  test('依啟動時間由舊到新編號，跳過本視窗', async () => {
    const keys = hotkeys([peer('busy', 30), peer('idle', 10), peer('idle', 20)], 's10')
    expect(keys).toEqual({ s20: '1', s30: '2' })
  })
  test('清單重新排序時編號不變', async () => {
    const a = [peer('idle', 10), peer('idle', 20), peer('idle', 30)]
    expect(hotkeys(sortPeers(a), 'x')).toEqual(hotkeys([...a].reverse(), 'x'))
  })
  test('有 session 結束時後面的往前補', async () => {
    expect(hotkeys([peer('idle', 20), peer('idle', 30)], 'x')).toEqual({ s20: '1', s30: '2' })
  })
  test('超過 9 個時第 10 個起沒有編號', async () => {
    const many = Array.from({ length: 11 }, (_, i) => peer('idle', i + 1))
    const keys = hotkeys(many, 'x')
    expect([Object.keys(keys).length, keys.s9, keys.s10]).toEqual([9, '9', undefined])
  })
  test('啟動時間相同時依 pid 排', async () => {
    const a = { ...peer('idle', 5), pid: 2, sessionId: 'b' }
    const b = { ...peer('idle', 5), pid: 1, sessionId: 'a' }
    expect(hotkeys([a, b], 'x')).toEqual({ a: '1', b: '2' })
  })
})

describe('/sessions 參數', () => {
  test('沒有參數就開關面板', async () => {
    expect(parseSessionsArgs('  ')).toEqual({ kind: 'toggle' })
  })
  test('1～9 跳到對應編號', async () => {
    expect(parseSessionsArgs(' 3 ')).toEqual({ kind: 'jump', key: '3' })
  })
  test('其他內容顯示用法', async () => {
    for (const args of ['0', '10', 'abc']) expect(parseSessionsArgs(args)).toEqual({ kind: 'usage' })
  })
  test('theme 不帶名稱就輪流', async () => {
    expect(parseSessionsArgs('theme')).toEqual({ kind: 'theme' })
  })
  test('theme 帶名稱就指定', async () => {
    expect(parseSessionsArgs('theme tiger')).toEqual({ kind: 'theme', name: 'tiger' })
    expect(parseSessionsArgs('theme puma')).toEqual({ kind: 'theme', name: 'puma' })
  })
  test('theme 的名稱不在這裡檢查', async () => {
    expect(parseSessionsArgs('theme xyz')).toEqual({ kind: 'theme', name: 'xyz' })
  })
  test('theme 前後與中間多餘的空白不影響', async () => {
    expect(parseSessionsArgs('  theme  ')).toEqual({ kind: 'theme' })
    expect(parseSessionsArgs(' theme   puma ')).toEqual({ kind: 'theme', name: 'puma' })
  })
  test('theme 後面超過一個字顯示用法', async () => {
    for (const args of ['theme a b', 'themes', 'theme1']) expect(parseSessionsArgs(args)).toEqual({ kind: 'usage' })
  })
  test('依編號找回 session', async () => {
    const list = [peer('busy', 30), peer('idle', 10), peer('idle', 20)]
    expect(peerForKey(list, 's10', '2')?.sessionId).toBe('s30')
  })
  test('沒有這個編號回 undefined', async () => {
    expect(peerForKey([peer('idle', 10)], 's10', '1')).toBeUndefined()
  })
})
