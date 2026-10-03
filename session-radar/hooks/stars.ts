/**
 * 綠雲與愛心主題的背景：閃爍的星空。星星是文字符號，蓋在場景上。
 * 位置由面板尺寸決定的固定種子產生，同尺寸下每格都在同一個位置；不跟著角色捲動。
 */
import type { Mark } from './frame'

export type Star = {
  line: number
  col: number
  glyph: '·' | '✦' | '✧'
  color: 'yellowBright' | 'whiteBright'
  /** 會不會閃爍；不閃的星一直亮著。 */
  twinkles: boolean
  /** 閃爍的起始相位，讓星星不會同時一起閃。 */
  phase: number
}

/** 平均每幾格放一顆星。 */
const CELLS_PER_STAR = 12

const GLYPHS: readonly Star['glyph'][] = ['·', '✦', '✧']
const COLORS: readonly Star['color'][] = ['yellowBright', 'whiteBright']

/** 閃爍一輪：亮 → 暗 → 消失 → 暗。每步維持 TWINKLE_FRAMES 格。 */
export const TWINKLE_STEPS = 4
const TWINKLE_FRAMES = 2

/** 固定種子的亂數（mulberry32）：同一個種子永遠產生同一串數字。 */
export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 面板 columns 欄、lines 行的星空：約每 12 格一顆，一半會閃。 */
export const starField = (columns: number, lines: number): Star[] => {
  const random = seeded(columns * 1009 + lines)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)] as T
  const count = Math.floor((columns * lines) / CELLS_PER_STAR)
  const taken = new Set<string>()
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const line = Math.floor(random() * lines)
    const col = Math.floor(random() * columns)
    const glyph = pick(GLYPHS)
    const color = pick(COLORS)
    const phase = Math.floor(random() * TWINKLE_STEPS)
    if (taken.has(`${line},${col}`)) continue
    taken.add(`${line},${col}`)
    stars.push({ line, col, glyph, color, twinkles: stars.length % 2 === 0, phase })
  }
  return stars
}

/** 第 frame 格時這顆星的樣子；空字串表示這格看不到。 */
export const starGlyph = (star: Star, frame: number): string => {
  if (!star.twinkles) return star.glyph
  const step = (Math.floor(frame / TWINKLE_FRAMES) + star.phase) % TWINKLE_STEPS
  return [star.glyph, '·', '', '·'][step] ?? star.glyph
}

/** 星星換成文字符號；blocked(line, col) 為真的格子（角色、對話框）不放。 */
export const starMarks = (stars: readonly Star[], frame: number, blocked: (line: number, col: number) => boolean): Mark[] =>
  stars.flatMap(star => {
    const text = starGlyph(star, frame)
    return text === '' || blocked(star.line, star.col) ? [] : [{ line: star.line, col: star.col, text, color: star.color }]
  })
