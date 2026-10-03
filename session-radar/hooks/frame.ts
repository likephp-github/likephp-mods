/**
 * 面板底部一格畫面的計算：依狀態取主題的動作、決定角色位置、合成場景、算出文字符號的位置。
 * 面板繪製與 README 動作圖的產生腳本共用這裡，兩邊看到的是同一套動畫。
 */
import { mirror, sized, spriteWidth } from './sprite'
import type { Sprite } from './sprite'
import type { State, Theme } from './theme'

/** 蓋在場景上的文字符號：第 line 行（文字行）、第 col 欄。 */
export type Mark = { line: number; col: number; text: string; color: string }

export type FrameInput = {
  theme: Theme
  state: State
  x: number
  facing: 1 | -1
  frame: number
  /** 角色的倍數（factorFor 算出來的）。 */
  factor: number
  columns: number
  /** 場景最多能佔幾行文字；放不下完整背景時由主題決定怎麼省略。 */
  rows: number
  /** 進入 resting 時抽的亂數（0 ≤ seed < 1），主題用來挑這段 resting 期間不變的內容（例如名言）。 */
  seed?: number
}

export type Frame = {
  sprite: Sprite
  marks: Mark[]
  /** 角色實際畫出的 x。 */
  x: number
  /** 角色最上面那一行文字。 */
  tigerLine: number
  /** 角色可走的範圍與每步欄數，給走路的計時器用。 */
  room: number
  stride: number
}

export const paneFrame = (input: FrameInput): Frame => {
  const fitted = input.theme.fit?.(input.factor) ?? input.factor
  const o = fitted === input.factor ? input : { ...input, factor: fitted }
  const act = o.theme.acts[o.state]
  const pose = sized(act.pose(o.frame), o.factor)
  const width = spriteWidth(pose)
  const room = Math.max(0, o.columns - width)
  const stride = Math.max(1, Math.round(o.factor))
  const x = act.place?.(o, width) ?? Math.min(o.x, room)
  // 背景位移跟著角色實際畫出的 x
  const scene = o.theme.compose({ pose: o.facing === 1 ? pose : mirror(pose), x, columns: o.columns, rows: o.rows })
  const tigerLine = Math.floor(scene.top / 2)
  const marks = act.marks?.(o, { x, width, top: scene.top, line: tigerLine }) ?? []

  return { sprite: scene.sprite, marks, x, tigerLine, room, stride }
}
