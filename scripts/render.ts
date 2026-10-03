/**
 * 把 session-radar 的動畫畫成 GIF 的每一格：直接載入 mod 的模組，
 * 用面板繪製同一個 paneFrame() 算出每一格，再把像素放大成色塊。
 */
import { registerHooks } from 'node:module'

import type { Frame, FrameInput } from '../session-radar/hooks/frame'

/** 每個像素畫成幾 px 見方。 */
export const SCALE = 8
/** 面板欄數：40 欄 × 8px = 320px。 */
export const COLUMNS = 40
export const BACKGROUND = '#1e1e1e'

/** 符號的顏色名稱換成色碼（終端機常見的配色）。 */
const MARK_COLORS: Record<string, string> = {
  cyan: '#56b6c2',
  yellow: '#e5c07b',
  magenta: '#c678dd',
}

/** 蝴蝶與打呼的點陣：每個字 4×8 點，每點 2×2px，剛好填滿一格文字（8×16px）。 */
export const GLYPHS: Record<string, readonly string[]> = {
  'ʚ': ['....', '.##.', '#..#', '#.#.', '.##.', '#..#', '.##.', '....'],
  'ɞ': ['....', '.##.', '#..#', '.#.#', '.##.', '#..#', '.##.', '....'],
  '>': ['....', '#...', '.#..', '..#.', '.#..', '#...', '....', '....'],
  '<': ['....', '...#', '..#.', '.#..', '..#.', '...#', '....', '....'],
  '*': ['....', '#.#.', '.#..', '###.', '.#..', '#.#.', '....', '....'],
  z: ['....', '....', '....', '####', '..#.', '.#..', '####', '....'],
  Z: ['####', '...#', '..#.', '.#..', '#...', '####', '....', '....'],
}

export type Mod = {
  paneFrame: (o: FrameInput) => Frame
  step: (w: { x: number; facing: 1 | -1 }, room: number, stride: number) => { x: number; facing: 1 | -1 }
  PALETTE: Record<string, string>
}

/**
 * 載入 mod 的模組。mod 的 import 不寫副檔名（Claude Code 的寫法），
 * Node 找不到時改試 .ts。
 */
export const loadMod = async (): Promise<Mod> => {
  registerHooks({
    resolve(specifier, context, next) {
      try {
        return next(specifier, context)
      } catch (err) {
        if (!specifier.startsWith('.') || /\.[cm]?[jt]sx?$/.test(specifier)) throw err
        return next(`${specifier}.ts`, context)
      }
    },
  })
  const frame = await import('../session-radar/hooks/frame.ts')
  const tiger = await import('../session-radar/hooks/tiger.ts')
  return { paneFrame: frame.paneFrame, step: tiger.step, PALETTE: tiger.PALETTE }
}

/** 色盤：背景、mod 的像素顏色、符號顏色。 */
export const paletteOf = (mod: Mod): string[] => [BACKGROUND, ...new Set(Object.values(mod.PALETTE)), ...Object.values(MARK_COLORS)]

export type Raster = { width: number; height: number; indices: number[] }

/**
 * 一格畫面放大成色彩索引：像素畫成 SCALE 見方的色塊，符號那一格先填下半像素的顏色再畫點陣。
 * pixels 是 mod 的色票（像素字元 → 色碼），palette 是 GIF 的色盤。
 */
export const rasterize = (frame: Frame, pixels: Record<string, string>, palette: readonly string[]): Raster => {
  const columns = frame.sprite[0]?.length ?? 0
  const width = columns * SCALE
  const height = frame.sprite.length * SCALE
  const indices = new Array<number>(width * height).fill(palette.indexOf(BACKGROUND))
  const colorAt = (px: string | undefined) => palette.indexOf(pixels[px ?? '.'] ?? BACKGROUND)
  const fill = (x0: number, y0: number, w: number, h: number, index: number) => {
    for (let y = y0; y < y0 + h; y++) indices.fill(index, y * width + x0, y * width + x0 + w)
  }

  frame.sprite.forEach((row, y) => [...row].forEach((px, x) => px !== '.' && fill(x * SCALE, y * SCALE, SCALE, SCALE, colorAt(px))))

  const dot = SCALE / 4
  for (const mark of frame.marks) {
    ;[...mark.text].forEach((ch, i) => {
      const col = mark.col + i
      const glyph = GLYPHS[ch]
      if (ch === ' ' || glyph === undefined || col < 0 || col >= columns) return
      const x0 = col * SCALE
      const y0 = mark.line * 2 * SCALE
      fill(x0, y0, SCALE, 2 * SCALE, colorAt(frame.sprite[mark.line * 2 + 1]?.[col]))
      const ink = palette.indexOf(MARK_COLORS[mark.color] ?? '#ffffff')
      glyph.forEach((r, gy) => [...r].forEach((d, gx) => d === '#' && fill(x0 + gx * dot, y0 + gy * dot, dot, dot, ink)))
    })
  }
  return { width, height, indices }
}

export type Clip = {
  name: 'walk' | 'play' | 'sleep'
  frames: Frame[]
  /** 最後一格之後的那一格；等於第一格才算無縫循環。 */
  after: Frame
}

const BASE = { factor: 1, columns: COLUMNS, rows: Number.POSITIVE_INFINITY }

/** 三段動畫：巡邏照實際速度來回一圈，抓蝴蝶與睡覺各播到動作完整循環。 */
export const clips = (mod: Mod): Clip[] => {
  // 巡邏：從左邊往右走，走到邊界轉身、走回原點，格數湊成偶數讓腳步也對上
  const walk: FrameInput[] = []
  let w: { x: number; facing: 1 | -1 } = { x: 0, facing: 1 }
  do {
    const input: FrameInput = { ...BASE, mode: 'walk', x: w.x, facing: w.facing, frame: walk.length }
    walk.push(input)
    const f = mod.paneFrame(input)
    w = mod.step(w, f.room, f.stride)
  } while (w.x !== 0 || w.facing !== 1 || walk.length % 2 !== 0)

  const loop = (mode: 'play' | 'sleep', x: number, count: number): FrameInput[] =>
    Array.from({ length: count }, (_, frame) => ({ ...BASE, mode, x, facing: 1, frame }))

  const make = (name: Clip['name'], inputs: FrameInput[], after: FrameInput): Clip => ({
    name,
    frames: inputs.map(mod.paneFrame),
    after: mod.paneFrame(after),
  })
  const play = loop('play', 4, 8)
  // 睡覺時老虎在正中間
  const middle = Math.floor(mod.paneFrame({ ...BASE, mode: 'sleep', x: 0, facing: 1, frame: 0 }).room / 2)
  const sleep = loop('sleep', middle, 48)
  return [
    make('walk', walk, { ...BASE, mode: 'walk', x: w.x, facing: w.facing, frame: walk.length }),
    make('play', play, { ...play[0]!, frame: play.length }),
    make('sleep', sleep, { ...sleep[0]!, frame: sleep.length }),
  ]
}
