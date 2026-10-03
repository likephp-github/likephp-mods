/**
 * 把 session-radar 的動畫畫成 GIF 的每一格：直接載入 mod 的模組，
 * 用面板繪製同一個 paneFrame() 算出每一格，再把像素放大成色塊。
 */
import { registerHooks } from 'node:module'

import type { Frame, FrameInput, Mark } from '../session-radar/hooks/frame'
import { charWidth, displayWidth } from '../session-radar/hooks/text.ts'
import type { State, Theme } from '../session-radar/hooks/theme'

/** 每個像素畫成幾 px 見方。 */
export const SCALE = 8
export const BACKGROUND = '#1e1e1e'

/** 符號的顏色名稱換成色碼（終端機常見的配色）。前三個是老虎用的，色盤一定會有。 */
const MARK_COLORS: Record<string, string> = {
  cyan: '#56b6c2',
  yellow: '#e5c07b',
  magenta: '#c678dd',
  white: '#dcdfe4',
  redBright: '#ff5f7a',
  yellowBright: '#ffd866',
  whiteBright: '#ffffff',
}
const BASE_MARK_COLORS = ['cyan', 'yellow', 'magenta']

/** 符號的點陣：每個字 4×8 點，每點 2×2px，剛好填滿一格文字（8×16px）。 */
export const GLYPHS: Record<string, readonly string[]> = {
  // 老虎：蝴蝶、打呼
  'ʚ': ['....', '.##.', '#..#', '#.#.', '.##.', '#..#', '.##.', '....'],
  'ɞ': ['....', '.##.', '#..#', '.#.#', '.##.', '#..#', '.##.', '....'],
  '>': ['....', '#...', '.#..', '..#.', '.#..', '#...', '....', '....'],
  '<': ['....', '...#', '..#.', '.#..', '..#.', '...#', '....', '....'],
  '*': ['....', '#.#.', '.#..', '###.', '.#..', '#.#.', '....', '....'],
  z: ['....', '....', '....', '####', '..#.', '.#..', '####', '....'],
  Z: ['####', '...#', '..#.', '.#..', '#...', '####', '....', '....'],
  // 綠雲與愛心：愛心、星星、nom、名言省略號
  '♥': ['....', '....', '#..#', '####', '####', '.##.', '....', '....'],
  '✦': ['....', '.#..', '.#..', '###.', '.#..', '.#..', '....', '....'],
  '✧': ['....', '....', '.#..', '#.#.', '.#..', '....', '....', '....'],
  '·': ['....', '....', '....', '.#..', '....', '....', '....', '....'],
  n: ['....', '....', '....', '###.', '#..#', '#..#', '#..#', '....'],
  o: ['....', '....', '....', '.##.', '#..#', '#..#', '.##.', '....'],
  m: ['....', '....', '....', '####', '#.##', '#.##', '#.##', '....'],
  '…': ['....', '....', '....', '....', '....', '....', '#.#.', '....'],
}

export type Mod = {
  paneFrame: (o: FrameInput) => Frame
  step: (w: { x: number; facing: 1 | -1 }, room: number, stride: number) => { x: number; facing: 1 | -1 }
  /** 主題登錄表：名稱 → 主題。 */
  themes: Record<string, Theme>
}

/**
 * mod 的 import 不寫副檔名（Claude Code 的寫法），Node 找不到時改試 .ts。
 * 要在動態 import mod 模組之前呼叫；靜態 import 在 hook 註冊前就已解析完。
 */
export const allowExtensionlessImports = (): void => {
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
}

/** 載入 mod 的模組。 */
export const loadMod = async (): Promise<Mod> => {
  allowExtensionlessImports()
  const frame = await import('../session-radar/hooks/frame.ts')
  const sprite = await import('../session-radar/hooks/sprite.ts')
  const theme = await import('../session-radar/hooks/theme.ts')
  return { paneFrame: frame.paneFrame, step: sprite.step, themes: theme.THEMES }
}

/**
 * GIF 實際要畫的符號：含中文的行（名言）不畫，整段收成一個「…」，
 * 放在最下面那行名言的中間（中文字寬 2 欄）；其他符號原樣保留。
 */
export const gifMarks = (marks: readonly Mark[]): Mark[] => {
  const wide = marks.filter(m => [...m.text].some(ch => charWidth(ch) === 2))
  const kept = marks.filter(m => !wide.includes(m))
  const last = wide.reduce<Mark | undefined>((a, m) => (a === undefined || m.line > a.line ? m : a), undefined)
  if (last === undefined) return kept
  return [...kept, { line: last.line, col: last.col + Math.floor(displayWidth(last.text) / 2), text: '…', color: last.color }]
}

/**
 * 色盤：背景、主題的像素顏色、老虎用的三個符號顏色，再加上這些格子用到的其他符號顏色。
 * 老虎沒有用到其他顏色，色盤與以前相同，GIF 不會變。
 */
export const paletteOf = (theme: Theme, frames: readonly Frame[]): string[] => {
  const used = new Set(frames.flatMap(f => gifMarks(f.marks).map(m => m.color)))
  const extra = Object.keys(MARK_COLORS).filter(c => !BASE_MARK_COLORS.includes(c) && used.has(c))
  return [BACKGROUND, ...new Set(Object.values(theme.palette)), ...[...BASE_MARK_COLORS, ...extra].map(c => MARK_COLORS[c]!)]
}

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
  for (const mark of gifMarks(frame.marks)) {
    const ink = palette.indexOf(MARK_COLORS[mark.color] ?? '')
    if (ink < 0) throw new Error(`符號顏色 ${mark.color} 不在 GIF 色盤裡`)
    ;[...mark.text].forEach((ch, i) => {
      const col = mark.col + i
      const glyph = GLYPHS[ch]
      if (ch === ' ' || glyph === undefined || col < 0 || col >= columns) return
      const x0 = col * SCALE
      const y0 = mark.line * 2 * SCALE
      fill(x0, y0, SCALE, 2 * SCALE, colorAt(frame.sprite[mark.line * 2 + 1]?.[col]))
      glyph.forEach((r, gy) => [...r].forEach((d, gx) => d === '#' && fill(x0 + gx * dot, y0 + gy * dot, dot, dot, ink)))
    })
  }
  return { width, height, indices }
}

/** 每個主題怎麼拍：倍數、面板欄數，與各狀態的格數、位置。 */
export type ClipPlan = {
  factor: number
  /** 面板欄數；GIF 寬 = 欄數 × SCALE。 */
  columns: number
  /** working 來回一圈的格數要是這個數的倍數，讓腳步（與星星）也對上。 */
  walkPeriod: number
  resting: { frames: number; x: number | 'middle' }
  idle: { frames: number; x: number | 'middle' }
}

export const CLIP_PLANS: Record<string, ClipPlan> = {
  // 老虎：40 欄 × 8px = 320px，維持原本的 GIF
  tiger: { factor: 1, columns: 40, walkPeriod: 2, resting: { frames: 8, x: 4 }, idle: { frames: 48, x: 'middle' } },
  // 綠雲與愛心：原圖大小（1 倍）臉最清楚，寬 53 欄。面板 64 欄留 11 欄走路，
  // 來回一圈（含兩端轉身）24 格，剛好是走路 12 格與星星閃爍 8 格的公倍數
  puma: { factor: 1, columns: 64, walkPeriod: 24, resting: { frames: 8, x: 'middle' }, idle: { frames: 16, x: 'middle' } },
}

export type Clip = {
  /** GIF 檔名：<主題>-<狀態>。 */
  name: string
  theme: string
  state: State
  frames: Frame[]
  /** 最後一格之後的那一格；等於第一格才算無縫循環。 */
  after: Frame
}

/** 一個主題的三段動畫：working 照實際速度來回一圈，resting、idle 各播到動作完整循環。 */
const clipsOf = (mod: Mod, name: string, theme: Theme, plan: ClipPlan): Clip[] => {
  const base = { theme, factor: plan.factor, columns: plan.columns, rows: Number.POSITIVE_INFINITY, seed: 0 }
  // working：從左邊往右走，走到邊界轉身、走回原點，格數湊成 walkPeriod 的倍數
  const walk: FrameInput[] = []
  let w: { x: number; facing: 1 | -1 } = { x: 0, facing: 1 }
  do {
    const input: FrameInput = { ...base, state: 'working', x: w.x, facing: w.facing, frame: walk.length }
    walk.push(input)
    const f = mod.paneFrame(input)
    w = mod.step(w, f.room, f.stride)
  } while (w.x !== 0 || w.facing !== 1 || walk.length % plan.walkPeriod !== 0)

  const loop = (state: 'resting' | 'idle', at: ClipPlan['resting']): FrameInput[] => {
    const x = at.x === 'middle' ? Math.floor(mod.paneFrame({ ...base, state, x: 0, facing: 1, frame: 0 }).room / 2) : at.x
    return Array.from({ length: at.frames }, (_, frame) => ({ ...base, state, x, facing: 1, frame }))
  }
  const make = (state: State, inputs: FrameInput[], after: FrameInput): Clip => ({
    name: `${name}-${state}`,
    theme: name,
    state,
    frames: inputs.map(mod.paneFrame),
    after: mod.paneFrame(after),
  })
  const resting = loop('resting', plan.resting)
  const idle = loop('idle', plan.idle)
  return [
    make('working', walk, { ...base, state: 'working', x: w.x, facing: w.facing, frame: walk.length }),
    make('resting', resting, { ...resting[0]!, frame: resting.length }),
    make('idle', idle, { ...idle[0]!, frame: idle.length }),
  ]
}

/** 登錄表中每個主題 × 每個狀態一段動畫。 */
export const clips = (mod: Mod): Clip[] =>
  Object.entries(mod.themes).flatMap(([name, theme]) => {
    const plan = CLIP_PLANS[name]
    if (plan === undefined) throw new Error(`主題 ${name} 沒有 GIF 的拍攝設定（CLIP_PLANS）`)
    return clipsOf(mod, name, theme, plan)
  })
