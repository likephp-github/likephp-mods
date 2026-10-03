import { describe, expect, test } from 'claude-code/testing'

import { chooseTheme, parseThemeSetting, THEME_NAMES, withThemeSetting } from './choice'
import { DEFAULT_THEME, THEMES } from './theme'

// 輪流與指定用自己構造的名稱清單，登錄表之後加主題也不用改這裡
const NAMES = ['tiger', 'puma'] as const

describe('主題名稱清單', () => {
  test('依登錄表順序列出', async () => {
    expect(THEME_NAMES).toEqual(Object.keys(THEMES))
  })
  test('包含預設主題', async () => {
    expect(THEME_NAMES).toContain(DEFAULT_THEME)
  })
})

describe('切換主題', () => {
  test('沒指定名稱就換到下一個', async () => {
    expect(chooseTheme('tiger', undefined, NAMES)).toEqual({ kind: 'chosen', name: 'puma' })
  })
  test('最後一個之後回到第一個', async () => {
    expect(chooseTheme('puma', undefined, NAMES)).toEqual({ kind: 'chosen', name: 'tiger' })
  })
  test('只有一個主題時輪流仍是它自己', async () => {
    expect(chooseTheme('tiger', undefined, ['tiger'])).toEqual({ kind: 'chosen', name: 'tiger' })
  })
  test('目前主題不在清單裡時從第一個開始', async () => {
    expect(chooseTheme('gone', undefined, NAMES)).toEqual({ kind: 'chosen', name: 'tiger' })
  })
  test('指定名稱就直接換', async () => {
    expect(chooseTheme('tiger', 'puma', NAMES)).toEqual({ kind: 'chosen', name: 'puma' })
  })
  test('指定目前的主題也算切換成功', async () => {
    expect(chooseTheme('tiger', 'tiger', NAMES)).toEqual({ kind: 'chosen', name: 'tiger' })
  })
  test('不認得的名稱回可用清單', async () => {
    expect(chooseTheme('tiger', 'xyz', NAMES)).toEqual({ kind: 'unknown', name: 'xyz', names: ['tiger', 'puma'] })
  })
  test('物件內建屬性名稱不算主題', async () => {
    expect(chooseTheme('tiger', 'toString', NAMES).kind).toBe('unknown')
  })
})

describe('設定檔解析', () => {
  test('讀出主題名稱', async () => {
    expect(parseThemeSetting('{ "theme": "puma" }', NAMES)).toBe('puma')
  })
  test('檔案不存在回 undefined', async () => {
    expect(parseThemeSetting(undefined, NAMES)).toBeUndefined()
  })
  test('壞掉的 JSON 回 undefined', async () => {
    expect(parseThemeSetting('{ "theme": "pu', NAMES)).toBeUndefined()
  })
  test('不認得的名稱回 undefined', async () => {
    expect(parseThemeSetting('{ "theme": "xyz" }', NAMES)).toBeUndefined()
  })
  test('不是物件回 undefined', async () => {
    for (const text of ['null', '"puma"', '["puma"]']) expect(parseThemeSetting(text, NAMES)).toBeUndefined()
  })
  test('沒有 theme 欄位回 undefined', async () => {
    expect(parseThemeSetting('{ "other": 1 }', NAMES)).toBeUndefined()
  })
  test('預設用登錄表的名稱', async () => {
    expect(parseThemeSetting(`{ "theme": "${DEFAULT_THEME}" }`)).toBe(DEFAULT_THEME)
  })
})

describe('設定檔寫入', () => {
  test('保留既有的其他欄位', async () => {
    const text = withThemeSetting('{ "other": 1, "theme": "tiger" }', 'puma')
    expect(JSON.parse(text)).toEqual({ other: 1, theme: 'puma' })
  })
  test('檔案不存在時只寫主題', async () => {
    expect(JSON.parse(withThemeSetting(undefined, 'puma'))).toEqual({ theme: 'puma' })
  })
  test('壞掉的 JSON 時重寫成只有主題', async () => {
    expect(JSON.parse(withThemeSetting('{ "oth', 'puma'))).toEqual({ theme: 'puma' })
  })
  test('寫回去的內容讀得回同一個主題', async () => {
    expect(parseThemeSetting(withThemeSetting('{}', 'puma'), NAMES)).toBe('puma')
  })
})
