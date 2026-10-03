import { describe, expect, test } from 'claude-code/testing'

import { ago, look, parsePeer, sortPeers } from './sessions'

const peer = (status: string, since: number) => ({
  pid: since,
  sessionId: `s${since}`,
  name: `n${since}`,
  status,
  kind: 'interactive',
  cwd: '/x',
  since,
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
