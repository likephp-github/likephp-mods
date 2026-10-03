import { describe, expect, test } from 'claude-code/testing'

import { paneFrame } from './frame'
import type { Frame } from './frame'
import { SNAPSHOT, SNAPSHOT_CASES, SNAPSHOT_FRAMES } from './frame.snapshot'
import { TREE_HEIGHT } from './scene'
import type { State } from './theme'
import { FLIGHT_ROOM, flight, snore, tiger } from './tiger'

const base = { theme: tiger, x: 0, facing: 1 as const, frame: 0, factor: 1, columns: 40, rows: 100 }
const tigerCols = (sprite: readonly string[]) => {
  const cols = new Set<number>()
  for (const row of sprite) [...row].forEach((px, i) => 'OKWEN'.includes(px) && cols.add(i))
  return [...cols]
}

describe('位置', () => {
  test('走路時老虎在 x，超出可走範圍就靠右', async () => {
    const f = paneFrame({ ...base, state: 'working', x: 100 })
    expect([f.room, f.x]).toEqual([22, 22])
  })
  test('步幅跟著倍數', async () => {
    expect(paneFrame({ ...base, state: 'working', factor: 1.5 }).stride).toBe(2)
  })
  test('抓蝴蝶面向右時讓出前方空間', async () => {
    const f = paneFrame({ ...base, state: 'resting', x: 22 })
    expect(f.x).toBe(40 - 18 - FLIGHT_ROOM)
  })
  test('抓蝴蝶面向左時讓出前方空間', async () => {
    expect(paneFrame({ ...base, state: 'resting', x: 0, facing: -1 }).x).toBe(FLIGHT_ROOM)
  })
  test('老虎畫在 x 的位置', async () => {
    const f = paneFrame({ ...base, state: 'working', x: 5 })
    expect(Math.min(...tigerCols(f.sprite))).toBe(5)
  })
})

describe('符號', () => {
  test('走路時沒有符號', async () => {
    expect(paneFrame({ ...base, state: 'working' }).marks).toEqual([])
  })
  test('睡覺時打呼靠老虎右緣、在頭頂那一行', async () => {
    const f = paneFrame({ ...base, state: 'idle', x: 3, frame: 4 })
    const zzz = snore(4)
    expect(f.marks).toEqual([{ line: f.tigerLine - 1, col: 3 + 18 - zzz.length, text: zzz, color: 'cyan' }])
  })
  test('抓蝴蝶時蝴蝶在面向那一側', async () => {
    const f = paneFrame({ ...base, state: 'resting', x: 0, frame: 0 })
    const fly = flight(0, 0)
    expect(f.marks[0]).toEqual({ line: f.tigerLine - 1, col: 0 + 18 + fly.col, text: fly.glyph, color: 'magenta' })
  })
  test('被拍到時是黃色', async () => {
    const hit = Array.from({ length: 8 }, (_, i) => i).find(i => flight(i, 2).isHit) ?? 0
    expect(paneFrame({ ...base, state: 'resting', frame: hit }).marks[0]?.color).toBe('yellow')
  })
})

describe('樹', () => {
  test('放得下時畫樹', async () => {
    const f = paneFrame({ ...base, state: 'working' })
    expect(f.sprite.filter(r => r.includes('B')).length).toBeGreaterThan(0)
  })
  test('放不下時只畫草', async () => {
    const f = paneFrame({ ...base, state: 'working', rows: TREE_HEIGHT / 2 })
    expect(f.sprite.some(r => r.includes('B') || r.includes('G'))).toBe(false)
  })
})

/** 與快照產生時相同的雜湊：一格畫面序列化後的 FNV-1a。 */
const digest = (f: Frame): string => {
  const s = JSON.stringify({ sprite: f.sprite, marks: f.marks, x: f.x, line: f.tigerLine, room: f.room, stride: f.stride })
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

describe('重構前後逐格相同', () => {
  const states: readonly State[] = ['working', 'resting', 'idle']
  for (const state of states) {
    test(`tiger 主題 ${state} 每組輸入連續 ${SNAPSHOT_FRAMES} 格與快照相同`, async () => {
      const got = SNAPSHOT_CASES.map(c =>
        Array.from({ length: SNAPSHOT_FRAMES }, (_, frame) => digest(paneFrame({ ...c, theme: tiger, state, frame }))).join(' '),
      )
      expect(got).toEqual([...SNAPSHOT[state]])
    })
  }
})
