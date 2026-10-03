import { describe, expect, test } from 'claude-code/testing'

import { DANGO } from './dango'
import { PUMA_PALETTE, PUMA_WALK } from './puma-sprites'
import { PALETTE } from './tiger'

const pixels = (s: readonly string[]): string[] => s.flatMap(row => [...row])
const has = (s: readonly string[], ch: string): boolean => s.some(row => row.includes(ch))

describe('puma 走路圖', () => {
  test('12 格', async () => {
    expect(PUMA_WALK.length).toBe(12)
  })
  test('每格同寬同高', async () => {
    const width = PUMA_WALK[0]?.[0]?.length
    const height = PUMA_WALK[0]?.length
    expect(PUMA_WALK.every(f => f.length === height && f.every(row => row.length === width))).toBe(true)
  })
  test('尺寸是原圖還原的原始像素（約 53×38）', async () => {
    const width = PUMA_WALK[0]?.[0]?.length ?? 0
    const height = PUMA_WALK[0]?.length ?? 0
    expect(Math.abs(width - 53) <= 3 && Math.abs(height - 38) <= 3).toBe(true)
  })
  test('只用 puma 調色盤的字元與透明', async () => {
    expect(PUMA_WALK.every(f => pixels(f).every(c => c === '.' || c in PUMA_PALETTE))).toBe(true)
  })
  test('每格都有眼白', async () => {
    expect(PUMA_WALK.every(f => has(f, 'I'))).toBe(true)
  })
  test('前 11 格有愛心，第 12 格沒有', async () => {
    expect(PUMA_WALK.map(f => has(f, 'R'))).toEqual([...Array.from({ length: 11 }, () => true), false])
  })
  test('腳底對齊最後一列', async () => {
    expect(PUMA_WALK.every(f => /[^.]/.test(f.at(-1) ?? ''))).toBe(true)
  })
  test('調色盤字元不與老虎衝突', async () => {
    expect(Object.keys(PUMA_PALETTE).filter(c => c in PALETTE)).toEqual([])
  })
})

describe('三色丸子', () => {
  const balls = (s: readonly string[]) => ['P', 'I', 'C'].filter(c => has(s, c)).length
  test('4 個階段依序剩 3、2、1、0 顆', async () => {
    expect(DANGO.map(balls)).toEqual([3, 2, 1, 0])
  })
  test('從最上面的粉色開始吃', async () => {
    expect(DANGO.map(s => has(s, 'P'))).toEqual([true, false, false, false])
  })
  test('每個階段同寬同高、只用 puma 調色盤', async () => {
    expect(DANGO.every(s => s.length === 7 && s.every(row => row.length === 3))).toBe(true)
    expect(DANGO.every(s => pixels(s).every(c => c === '.' || c in PUMA_PALETTE))).toBe(true)
  })
})
