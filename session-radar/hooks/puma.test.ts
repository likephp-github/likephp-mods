import { describe, expect, test } from 'claude-code/testing'

import { DANGO } from './dango'
import { paneFrame } from './frame'
import type { FrameInput, Mark } from './frame'
import {
  BASE_MIN_FACTOR,
  DANGO_AT,
  DANGO_FRAMES,
  dangoStage,
  eatPose,
  hasPupil,
  MIN_FACTOR,
  puma,
  QUOTES,
  quoteFor,
  WALK,
} from './puma'
import { PUMA_WALK } from './puma-sprites'
import { factorFor, mirror, sized, spriteWidth } from './sprite'
import { starField } from './stars'
import { displayWidth, ELLIPSIS } from './text'

const base: Omit<FrameInput, 'state'> = { theme: puma, x: 0, facing: 1, frame: 0, factor: MIN_FACTOR, columns: 40, rows: 100 }
const STAR = /^[·✦✧]$/
const stars = (marks: readonly Mark[]) => marks.filter(m => STAR.test(m.text))
const words = (marks: readonly Mark[]) => marks.filter(m => !STAR.test(m.text))
/** 某個像素字元出現的欄。 */
const colsOf = (sprite: readonly string[], ch: string) => sprite.flatMap(row => [...row].flatMap((px, x) => (px === ch ? [x] : [])))
/** 畫出角色像素的行數。 */
const figureLines = (sprite: readonly string[]) => {
  const rows = sprite.flatMap((row, y) => (/[^.]/.test(row) ? [y] : []))
  return Math.ceil(((rows.at(-1) ?? 0) + 1) / 2) - Math.floor((rows[0] ?? 0) / 2)
}
/** 名言的那幾行（不含 ♥）。 */
const quoteLines = (marks: readonly Mark[]) => words(marks).filter(m => m.text !== '♥')
const longest = QUOTES.reduce((a, b) => (displayWidth(b) > displayWidth(a) ? b : a))
const seedOf = (quote: string) => (QUOTES.indexOf(quote) + 0.5) / QUOTES.length

describe('puma 主題登錄', () => {
  test('主題名稱是 puma', async () => {
    expect(puma.name).toBe('puma')
  })
  test('體型以 puma 自己的寬度計算', async () => {
    expect(puma.width).toBe(spriteWidth(PUMA_WALK[0] ?? []))
  })
})

describe('working：走路', () => {
  test('12 格依序出現、之後重來', async () => {
    const poses = Array.from({ length: 24 }, (_, i) => puma.acts.working.pose(i))
    expect(poses.every((p, i) => p === WALK[i % 12])).toBe(true)
  })
  test('主題的姿勢面向右：是原圖（朝左）的翻轉版', async () => {
    expect(WALK.every((p, i) => JSON.stringify(p) === JSON.stringify(mirror(PUMA_WALK[i] ?? [])))).toBe(true)
  })
  test('往右走時愛心在綠雲後方（左邊）', async () => {
    const f = paneFrame({ ...base, state: 'working', x: 5, facing: 1 })
    expect(Math.min(...colsOf(f.sprite, 'R'))).toBeLessThan(Math.min(...colsOf(f.sprite, 'C')))
  })
  test('往左走時是原圖方向，愛心在右邊', async () => {
    const f = paneFrame({ ...base, state: 'working', x: 5, facing: -1 })
    expect(Math.max(...colsOf(f.sprite, 'R'))).toBeGreaterThan(Math.max(...colsOf(f.sprite, 'C')))
  })
  test('走路時沒有對話框', async () => {
    expect(words(paneFrame({ ...base, state: 'working' }).marks)).toEqual([])
  })
})

describe('resting：♥ 與名言', () => {
  const quoteOf = (o: Partial<FrameInput>) => quoteLines(paneFrame({ ...base, state: 'resting', ...o }).marks).map(m => m.text).join('')
  test('同一段 resting 連續多格的名言相同', async () => {
    const seen = new Set(Array.from({ length: 30 }, (_, frame) => quoteOf({ frame, seed: 0.42 })))
    expect(seen.size).toBe(1)
  })
  test('兩次進入 resting 抽到不同亂數時名言可能不同', async () => {
    expect(quoteOf({ seed: 0.05 })).not.toBe(quoteOf({ seed: 0.95 }))
  })
  test('每一句都抽得到', async () => {
    expect(new Set(Array.from({ length: 60 }, (_, i) => quoteFor(i / 60))).size).toBe(QUOTES.length)
  })
  test('名言前後加「」', async () => {
    const short = '我本來就不是以外表取勝。'
    expect(quoteOf({ seed: seedOf(short) })).toBe(`「${short}」`)
  })
  test('♥ 在頭頂，名言在 ♥ 上面', async () => {
    const marks = words(paneFrame({ ...base, state: 'resting', seed: 0 }).marks)
    const heart = marks.find(m => m.text === '♥')
    expect(heart !== undefined && quoteLines(marks).every(m => m.line < heart.line)).toBe(true)
  })
  test('最長那句在 40 欄時自動換行成 3 行以內、每行不超過面板寬', async () => {
    const lines = quoteLines(paneFrame({ ...base, state: 'resting', seed: seedOf(longest) }).marks)
    expect(lines.length <= 3 && lines.length > 1 && lines.every(m => displayWidth(m.text) <= 40)).toBe(true)
  })
  for (const [label, x, facing] of [
    ['靠左', 0, -1],
    ['靠右', 999, 1],
  ] as const) {
    test(`角色${label}時對話框仍完整在面板內`, async () => {
      const f = paneFrame({ ...base, state: 'resting', columns: 30, x, facing, seed: seedOf(longest) })
      const marks = words(f.marks)
      expect(marks.length).toBeGreaterThan(1)
      expect(marks.every(m => m.col >= 0 && m.col + displayWidth(m.text) <= 30)).toBe(true)
    })
  }
})

describe('行數不夠時依序讓出', () => {
  const at = (rows: number) => paneFrame({ ...base, state: 'resting', rows, seed: seedOf(longest) })
  const full = at(100)
  const tall = figureLines(full.sprite)
  test('行數充足時名言最多 3 行', async () => {
    expect(quoteLines(full.marks).length).toBe(3)
  })
  test('少了幾行時名言縮成 1 行並以 … 截斷', async () => {
    const lines = quoteLines(at(Math.ceil(sized(WALK[0] ?? [], MIN_FACTOR).length / 2) + 2).marks)
    expect([lines.length, lines[0]?.text.endsWith(ELLIPSIS)]).toEqual([1, true])
  })
  test('再少就不顯示名言、只留 ♥', async () => {
    const marks = words(at(Math.ceil(sized(WALK[0] ?? [], MIN_FACTOR).length / 2)).marks)
    expect(marks.map(m => m.text)).toEqual(['♥'])
  })
  test('角色本身不會因為行數不夠而縮小', async () => {
    expect(figureLines(at(3).sprite)).toBe(tall)
  })
})

describe('idle：吃丸子', () => {
  const balls = (frame: number) => {
    const raw = mirror(eatPose(frame))
    const region = raw.slice(DANGO_AT.y, DANGO_AT.y + 7).map(row => row.slice(DANGO_AT.x, DANGO_AT.x + 3))
    return ['P', 'I', 'C'].filter(c => region.some(row => row.includes(c))).length
  }
  const cycle = Array.from({ length: DANGO.length + 1 }, (_, i) => i * DANGO_FRAMES)
  test('丸子顆數依 3、2、1、0 循環', async () => {
    expect(cycle.map(balls)).toEqual([3, 2, 1, 0, 3])
  })
  test('2 顆那格頭頂有 nom，其他格沒有', async () => {
    const noms = cycle.map(frame => words(paneFrame({ ...base, state: 'idle', frame }).marks).some(m => m.text === 'nom'))
    expect(noms).toEqual([false, true, false, false, false])
  })
  test('nom 在角色頭頂上方', async () => {
    const f = paneFrame({ ...base, state: 'idle', frame: DANGO_FRAMES })
    const nom = f.marks.find(m => m.text === 'nom')
    const head = Math.floor(f.sprite.findIndex(row => /[^.]/.test(row)) / 2)
    expect(nom?.line).toBe(head - 1)
  })
  test('停在原地：不同格的位置一樣', async () => {
    expect(new Set(cycle.map(frame => paneFrame({ ...base, state: 'idle', x: 7, frame }).x)).size).toBe(1)
  })
  test('愛心不動', async () => {
    const hearts = cycle.map(frame => JSON.stringify(eatPose(frame).map(row => row.replace(/[^R]/g, '.'))))
    expect(new Set(hearts).size).toBe(1)
  })
  test('不打呼', async () => {
    const all = Array.from({ length: 16 }, (_, frame) => words(paneFrame({ ...base, state: 'idle', frame }).marks))
    expect(all.flat().some(m => /z/i.test(m.text))).toBe(false)
  })
  test('丸子階段每 DANGO_FRAMES 格換一次', async () => {
    expect([0, DANGO_FRAMES - 1, DANGO_FRAMES].map(dangoStage)).toEqual([0, 0, 1])
  })
})

describe('尺寸', () => {
  test('最小倍數不低於 0.5', async () => {
    expect(MIN_FACTOR >= BASE_MIN_FACTOR).toBe(true)
  })
  test('還沒有用量時用 puma 的最小倍數', async () => {
    expect(factorFor(undefined, 40, puma)).toBe(MIN_FACTOR)
  })
  test('實際使用的最小倍數下，12 格每格都還有黑眼珠', async () => {
    expect(WALK.map(p => hasPupil(sized(p, MIN_FACTOR)))).toEqual(WALK.map(() => true))
  })
  test('倍數 0.5 時至少一格看不到黑眼珠，所以保底把倍數調高', async () => {
    expect(WALK.every(p => hasPupil(sized(p, BASE_MIN_FACTOR)))).toBe(false)
    expect(MIN_FACTOR).toBeGreaterThan(BASE_MIN_FACTOR)
  })
  test('面板傳進來較小的倍數時，實際畫出的寬度是保底後的寬度', async () => {
    const f = paneFrame({ ...base, state: 'working', factor: BASE_MIN_FACTOR })
    expect(f.room).toBe(40 - spriteWidth(sized(WALK[0] ?? [], MIN_FACTOR)))
  })
  test('任何倍數經主題微調後都不會變小，且每格都有黑眼珠', async () => {
    const factors = Array.from({ length: 101 }, (_, i) => 0.5 + i / 100)
    const fit = puma.fit ?? (f => f)
    expect(factors.every(f => fit(f) >= f && WALK.every(p => hasPupil(sized(p, fit(f)))))).toBe(true)
  })
  test('眼白整塊變白就不算看得到黑眼珠', async () => {
    expect([hasPupil(['XIIIX']), hasPupil(['IXI']), hasPupil(['I', 'X', 'I'])]).toEqual([false, true, true])
  })
  test('面板比角色窄時不畫角色，也沒有對話框', async () => {
    const width = spriteWidth(sized(WALK[0] ?? [], MIN_FACTOR))
    const f = paneFrame({ ...base, state: 'resting', columns: width - 1, seed: 0 })
    expect(f.sprite.every(row => /^\.*$/.test(row))).toBe(true)
    expect(words(f.marks)).toEqual([])
  })
})

describe('背景：星空', () => {
  test('沒有地面：角色腳底就是場景最後一列', async () => {
    const f = paneFrame({ ...base, state: 'working' })
    expect(/[^.]/.test(f.sprite.at(-1) ?? '')).toBe(true)
  })
  test('同尺寸下每格的星星位置相同（不視差）', async () => {
    const frameAt = (x: number, frame: number) => paneFrame({ ...base, state: 'working', x, frame })
    const lines = frameAt(0, 0).sprite.length / 2
    const field = new Set(starField(40, lines).map(s => `${s.line},${s.col}`))
    // 角色走到哪裡，看得到的星星都是同一片星空裡的位置，不跟著角色捲動
    const seen = [0, 6, 12].flatMap(x => [0, 1, 2].flatMap(frame => stars(frameAt(x, frame).marks)))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every(m => field.has(`${m.line},${m.col}`))).toBe(true)
  })
  for (const state of ['working', 'resting', 'idle'] as const) {
    test(`${state}：星星不與角色或對話框重疊`, async () => {
      for (const frame of [0, 3, 5, 8]) {
        const f = paneFrame({ ...base, state, x: 4, frame, seed: 0.5, rows: 30 })
        const opaque = (y: number, col: number) => (f.sprite[y]?.[col] ?? '.') !== '.'
        const figure = (line: number, col: number) => opaque(line * 2, col) || opaque(line * 2 + 1, col)
        const text = words(f.marks)
        const onText = (m: Mark) => text.some(t => t.line === m.line && m.col >= t.col && m.col < t.col + displayWidth(t.text))
        expect(stars(f.marks).some(m => figure(m.line, m.col) || onText(m))).toBe(false)
      }
    })
  }
  test('有閃爍的星：同一顆星在不同格會變樣或消失', async () => {
    const at = (frame: number) => new Map(stars(paneFrame({ ...base, state: 'resting', frame, seed: 0 }).marks).map(m => [`${m.line},${m.col}`, m.text]))
    const a = at(0)
    const later = [1, 2, 3, 4, 5, 6, 7].map(at)
    expect(later.some(b => [...a].some(([cell, glyph]) => b.get(cell) !== glyph))).toBe(true)
  })
})
