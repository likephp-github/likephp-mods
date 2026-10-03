/**
 * 面板底部的主題：一組角色、背景，與它們在各個狀態下的動作。
 * 狀態與主題無關；主題決定每個狀態要演什麼。
 */
import type { FrameInput, Mark } from './frame'
import type { Sprite } from './sprite'
import { puma } from './puma'
import { tiger } from './tiger'

/** session 的活動程度：工作中、回覆結束後 30 秒內、閒置超過 30 秒。 */
export type State = 'working' | 'resting' | 'idle'

/** 閒置多久後從 resting 進入 idle。 */
export const NAP_AFTER_MS = 30_000

export const stateFor = (isWorking: boolean, idleSince: number, now: number): State => {
  if (isWorking) return 'working'
  return idleSince > 0 && now - idleSince < NAP_AFTER_MS ? 'resting' : 'idle'
}

/** 背景與角色合成後的整格畫面。 */
export type Scene = {
  sprite: Sprite
  /** 角色最上面一列像素在場景裡的列數。 */
  top: number
}

/** 角色在這一格實際的位置：x、寬度（欄）、最上面一列像素、最上面一行文字。 */
export type Placed = { x: number; width: number; top: number; line: number }

/** 主題在某個狀態下的動作。 */
export type Act = {
  /** 第 frame 格的姿勢：原始大小、面向右。 */
  pose: (frame: number) => Sprite
  /** 角色實際畫在哪一欄；沒有時夾在可走範圍內。width 是縮放後的寬度。 */
  place?: (o: FrameInput, width: number) => number
  /** 蓋在場景上的文字符號；沒有時不畫。 */
  marks?: (o: FrameInput, at: Placed) => Mark[]
}

export type Theme = {
  name: string
  acts: Record<State, Act>
  /** 背景合成：把擺好的角色疊到背景上；rows 是場景最多能佔幾行文字。 */
  compose: (o: { pose: Sprite; x: number; columns: number; rows: number }) => Scene
  /** 像素字元 → 色碼，涵蓋角色與背景。 */
  palette: Record<string, string>
  /** 角色 1 倍時的像素寬，給 factorFor 算體型。 */
  width: number
  /** 體型的最小倍數。 */
  minFactor: number
  /** 依面板算出的倍數再由主題微調（例如保證縮小後還看得到眼睛）；沒有時照用。 */
  fit?: (factor: number) => number
}

export const THEMES = { tiger, puma } satisfies Record<string, Theme>

export type ThemeName = keyof typeof THEMES

export const DEFAULT_THEME: ThemeName = 'tiger'

/** 以名稱取得主題；不認得的名稱用預設主題。 */
export const themeFor = (name: string): Theme => (Object.hasOwn(THEMES, name) ? THEMES[name as ThemeName] : THEMES[DEFAULT_THEME])
