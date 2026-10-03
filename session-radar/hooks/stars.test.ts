import { describe, expect, test } from 'claude-code/testing'

import { seeded, starField, starGlyph, starMarks, TWINKLE_STEPS } from './stars'

const frames = Array.from({ length: TWINKLE_STEPS * 4 }, (_, i) => i)

describe('星空', () => {
  test('同尺寸兩次產生的位置相同', async () => {
    expect(starField(40, 20)).toEqual(starField(40, 20))
  })
  test('尺寸不同位置就不同', async () => {
    expect(starField(40, 20)).not.toEqual(starField(41, 20))
  })
  test('星星都在面板範圍內、不重疊', async () => {
    const stars = starField(30, 12)
    const cells = new Set(stars.map(s => `${s.line},${s.col}`))
    expect(stars.every(s => s.line >= 0 && s.line < 12 && s.col >= 0 && s.col < 30)).toBe(true)
    expect(cells.size).toBe(stars.length)
  })
  test('約一半的星星會閃爍', async () => {
    const stars = starField(40, 20)
    const twinkling = stars.filter(s => s.twinkles).length
    expect(Math.abs(twinkling - stars.length / 2) <= 1).toBe(true)
  })
  test('會閃的星有時看不到，不閃的星一直一樣', async () => {
    const stars = starField(40, 20)
    const still = stars.find(s => !s.twinkles)
    const twinkle = stars.find(s => s.twinkles)
    expect(new Set(frames.map(f => starGlyph(still!, f))).size).toBe(1)
    expect(frames.some(f => starGlyph(twinkle!, f) === '')).toBe(true)
    expect(frames.some(f => starGlyph(twinkle!, f) === twinkle!.glyph)).toBe(true)
  })
  test('閃爍的起始相位錯開，不會同時一起消失', async () => {
    const twinkling = starField(40, 20).filter(s => s.twinkles)
    expect(new Set(twinkling.map(s => s.phase)).size).toBeGreaterThan(1)
  })
  test('只用 ·、✦、✧ 三種符號，亮黃或白', async () => {
    const stars = starField(40, 20)
    expect(stars.every(s => ['·', '✦', '✧'].includes(s.glyph) && ['yellowBright', 'whiteBright'].includes(s.color))).toBe(true)
  })
  test('被擋住的格子不放星星', async () => {
    const stars = starField(20, 10)
    const marks = starMarks(stars, 0, line => line < 5)
    expect(marks.every(m => m.line >= 5)).toBe(true)
  })
  test('固定種子的亂數可重現', async () => {
    const a = seeded(7)
    const b = seeded(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
