/**
 * 面板底部一格畫面的計算：挑姿勢、決定老虎位置、合成場景、算出蝴蝶與打呼的位置。
 * 面板繪製與 README 動作圖的產生腳本共用這裡，兩邊看到的是同一套動畫。
 */
import { composeScene, fitsTrees } from './scene'
import type { Sprite } from './tiger'
import { FLIGHT_ROOM, PAW_ROW, PLAY_STEPS, SLEEP, WALK, flight, mirror, sized, sleepPose, snore, spriteWidth } from './tiger'
import type { Mode } from './tiger'

/** 蓋在場景上的文字符號：第 line 行（文字行）、第 col 欄。 */
export type Mark = { line: number; col: number; text: string; color: string }

export type FrameInput = {
  mode: Mode
  x: number
  facing: 1 | -1
  frame: number
  /** 老虎的倍數（factorFor 算出來的）。 */
  factor: number
  columns: number
  /** 場景最多能佔幾行文字；放不下含樹的場景時只畫草。 */
  rows: number
}

export type Frame = {
  sprite: Sprite
  marks: Mark[]
  /** 老虎實際畫出的 x。 */
  x: number
  /** 老虎最上面那一行文字。 */
  tigerLine: number
  /** 老虎可走的範圍與每步欄數，給走路的計時器用。 */
  room: number
  stride: number
}

const poseFor = (mode: Mode, frame: number): Sprite =>
  (mode === 'walk' ? WALK[frame % WALK.length] : mode === 'play' ? PLAY_STEPS[frame % PLAY_STEPS.length] : sleepPose(frame)) ?? SLEEP

export const paneFrame = (o: FrameInput): Frame => {
  const pose = sized(poseFor(o.mode, o.frame), o.factor)
  const width = spriteWidth(pose)
  const room = Math.max(0, o.columns - width)
  const stride = Math.max(1, Math.round(o.factor))
  // 抓蝴蝶時讓出前方空間給蝴蝶
  const x =
    o.mode !== 'play'
      ? Math.min(o.x, room)
      : o.facing === 1
        ? Math.max(0, Math.min(o.x, o.columns - width - FLIGHT_ROOM))
        : Math.min(room, Math.max(o.x, FLIGHT_ROOM))
  // 老虎疊在樹林前、站在草地上；背景位移跟著老虎實際畫出的 x
  const withTrees = fitsTrees(o.rows, 0, pose.length)
  const scene = composeScene({ pose: o.facing === 1 ? pose : mirror(pose), x, columns: o.columns, withTrees })
  const tigerLine = Math.floor(scene.top / 2)

  return { sprite: scene.sprite, marks: marksFor(o, x, width, scene.top, tigerLine), x, tigerLine, room, stride }
}

/** 頭頂那一行：睡覺時打呼，抓蝴蝶時蝴蝶在頭頂或掌邊；符號直接蓋在背景上。 */
const marksFor = (o: FrameInput, x: number, width: number, top: number, tigerLine: number): Mark[] => {
  if (o.mode === 'sleep') {
    const text = snore(o.frame)
    const col = Math.min(Math.max(0, x + width - text.length), o.columns - text.length)
    return [{ line: tigerLine - 1, col, text, color: 'cyan' }]
  }
  if (o.mode === 'play') {
    const pawLine = Math.floor((top + Math.floor(PAW_ROW * o.factor)) / 2)
    const fly = flight(o.frame, pawLine - tigerLine)
    // 蝴蝶的欄位：老虎面向哪邊，就在那一側的身體前緣外
    const col = o.facing === 1 ? x + width + fly.col : x - fly.glyph.length - fly.col
    return [{ line: tigerLine + fly.row, col, text: fly.glyph, color: fly.isHit ? 'yellow' : 'magenta' }]
  }
  return []
}
