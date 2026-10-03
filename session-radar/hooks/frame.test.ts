import { describe, expect, test } from 'claude-code/testing'

import { paneFrame } from './frame'
import { TREE_HEIGHT } from './scene'
import { FLIGHT_ROOM, flight, snore } from './tiger'

const base = { x: 0, facing: 1 as const, frame: 0, factor: 1, columns: 40, rows: 100 }
const tigerCols = (sprite: readonly string[]) => {
  const cols = new Set<number>()
  for (const row of sprite) [...row].forEach((px, i) => 'OKWEN'.includes(px) && cols.add(i))
  return [...cols]
}

describe('位置', () => {
  test('走路時老虎在 x，超出可走範圍就靠右', async () => {
    const f = paneFrame({ ...base, mode: 'walk', x: 100 })
    expect([f.room, f.x]).toEqual([22, 22])
  })
  test('步幅跟著倍數', async () => {
    expect(paneFrame({ ...base, mode: 'walk', factor: 1.5 }).stride).toBe(2)
  })
  test('抓蝴蝶面向右時讓出前方空間', async () => {
    const f = paneFrame({ ...base, mode: 'play', x: 22 })
    expect(f.x).toBe(40 - 18 - FLIGHT_ROOM)
  })
  test('抓蝴蝶面向左時讓出前方空間', async () => {
    expect(paneFrame({ ...base, mode: 'play', x: 0, facing: -1 }).x).toBe(FLIGHT_ROOM)
  })
  test('老虎畫在 x 的位置', async () => {
    const f = paneFrame({ ...base, mode: 'walk', x: 5 })
    expect(Math.min(...tigerCols(f.sprite))).toBe(5)
  })
})

describe('符號', () => {
  test('走路時沒有符號', async () => {
    expect(paneFrame({ ...base, mode: 'walk' }).marks).toEqual([])
  })
  test('睡覺時打呼靠老虎右緣、在頭頂那一行', async () => {
    const f = paneFrame({ ...base, mode: 'sleep', x: 3, frame: 4 })
    const zzz = snore(4)
    expect(f.marks).toEqual([{ line: f.tigerLine - 1, col: 3 + 18 - zzz.length, text: zzz, color: 'cyan' }])
  })
  test('抓蝴蝶時蝴蝶在面向那一側', async () => {
    const f = paneFrame({ ...base, mode: 'play', x: 0, frame: 0 })
    const fly = flight(0, 0)
    expect(f.marks[0]).toEqual({ line: f.tigerLine - 1, col: 0 + 18 + fly.col, text: fly.glyph, color: 'magenta' })
  })
  test('被拍到時是黃色', async () => {
    const hit = Array.from({ length: 8 }, (_, i) => i).find(i => flight(i, 2).isHit) ?? 0
    expect(paneFrame({ ...base, mode: 'play', frame: hit }).marks[0]?.color).toBe('yellow')
  })
})

describe('樹', () => {
  test('放得下時畫樹', async () => {
    const f = paneFrame({ ...base, mode: 'walk' })
    expect(f.sprite.filter(r => r.includes('B')).length).toBeGreaterThan(0)
  })
  test('放不下時只畫草', async () => {
    const f = paneFrame({ ...base, mode: 'walk', rows: TREE_HEIGHT / 2 })
    expect(f.sprite.some(r => r.includes('B') || r.includes('G'))).toBe(false)
  })
})
