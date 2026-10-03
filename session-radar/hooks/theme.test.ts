import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_THEME, NAP_AFTER_MS, stateFor, themeFor } from './theme'
import { puma } from './puma'
import { tiger } from './tiger'

describe('狀態', () => {
  test('工作中是 working', async () => {
    expect(stateFor(true, 0, 1000)).toBe('working')
  })
  test('剛閒置時是 resting', async () => {
    expect(stateFor(false, 1000, 1000 + 5_000)).toBe('resting')
  })
  test('閒置滿 30 秒就是 idle', async () => {
    expect(stateFor(false, 1000, 1000 + NAP_AFTER_MS)).toBe('idle')
  })
  test('從沒工作過直接 idle', async () => {
    expect(stateFor(false, 0, 5_000)).toBe('idle')
  })
})

describe('主題登錄表', () => {
  test('以名稱取得主題', async () => {
    expect(themeFor('tiger')).toBe(tiger)
  })
  test('登錄表裡有 puma', async () => {
    expect(themeFor('puma')).toBe(puma)
  })
  test('預設主題是 tiger', async () => {
    expect(themeFor(DEFAULT_THEME).name).toBe('tiger')
  })
  test('不認得的名稱用預設主題', async () => {
    expect(themeFor('toString')).toBe(themeFor(DEFAULT_THEME))
  })
})
