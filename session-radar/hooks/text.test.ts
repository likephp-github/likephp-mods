import { describe, expect, test } from 'claude-code/testing'

import { charWidth, displayWidth, ELLIPSIS, wrapText } from './text'

/** 最長那句名言（前後加「」）。 */
const LONGEST = '「如果有人說懷抱希望是一種錯誤，那麼我會每一次都反駁他。無論幾次，我都會堅定地說。」'

describe('顯示寬度', () => {
  test('中文字與全形標點佔 2 欄', async () => {
    expect(['我', '，', '。', '「', '」', '？'].map(charWidth)).toEqual([2, 2, 2, 2, 2, 2])
  })
  test('英數、♥ 與 … 佔 1 欄', async () => {
    expect(['a', '1', '♥', '…', '·'].map(charWidth)).toEqual([1, 1, 1, 1, 1])
  })
  test('字串寬度是各字相加', async () => {
    expect(displayWidth('「ab」')).toBe(6)
  })
})

describe('換行', () => {
  test('每行顯示寬度不超過可用寬度', async () => {
    expect(wrapText(LONGEST, 30, 3).every(l => displayWidth(l) <= 30)).toBe(true)
  })
  test('奇數寬度也不切半個寬字元：每行都是完整的字', async () => {
    const lines = wrapText(LONGEST, 29, 10)
    expect(lines.join('')).toBe(LONGEST)
    expect(lines.every(l => displayWidth(l) <= 29)).toBe(true)
  })
  test('最多 3 行', async () => {
    expect(wrapText(LONGEST, 20, 3).length).toBe(3)
  })
  test('放得下時不截斷', async () => {
    expect(wrapText('「我本來就不是以外表取勝。」', 30, 3)).toEqual(['「我本來就不是以外表取勝。」'])
  })
  test('最長那句在 30 欄、3 行內原文完整或以 … 結尾', async () => {
    const lines = wrapText(LONGEST, 30, 3)
    const text = lines.join('')
    expect(text === LONGEST || text.endsWith(ELLIPSIS)).toBe(true)
  })
  test('超出時最後一行以 … 結尾且不超寬', async () => {
    const lines = wrapText(LONGEST, 20, 3)
    expect(lines[2]?.endsWith(ELLIPSIS)).toBe(true)
    expect(lines.every(l => displayWidth(l) <= 20)).toBe(true)
  })
  test('縮成 1 行時以 … 截斷', async () => {
    const [line, ...rest] = wrapText(LONGEST, 30, 1)
    expect([line?.endsWith(ELLIPSIS), displayWidth(line ?? ''), rest.length]).toEqual([true, 29, 0])
  })
  test('寬度放不下一個寬字元時不畫', async () => {
    expect(wrapText(LONGEST, 1, 3)).toEqual([])
  })
})
