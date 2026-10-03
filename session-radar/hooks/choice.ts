/**
 * 使用者選的主題：/sessions theme 的切換規則，與 ~/.claude/session-radar.json 的讀寫。
 * 主題名稱一律從登錄表推導，新增主題時這裡不用改。
 */
import { THEMES } from './theme'
import type { ThemeName } from './theme'

/** 依登錄表順序的主題名稱，/sessions theme 依這個順序輪流。 */
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[]

/** 設定檔相對於家目錄的位置。 */
export const SETTINGS_PATH = '.claude/session-radar.json'

export type ThemeChoice = { kind: 'chosen'; name: string } | { kind: 'unknown'; name: string; names: string[] }

/** 沒指定名稱就換到清單中的下一個（最後一個之後回到第一個）；指定了就檢查名稱在不在清單裡。 */
export const chooseTheme = (current: string, name: string | undefined, names: readonly string[] = THEME_NAMES): ThemeChoice => {
  if (name === undefined) return { kind: 'chosen', name: names[(names.indexOf(current) + 1) % names.length] ?? current }
  return names.includes(name) ? { kind: 'chosen', name } : { kind: 'unknown', name, names: [...names] }
}

/** 設定檔內容轉成物件；不存在、壞掉或不是物件時回 undefined。 */
const parseObject = (text: string | undefined): Record<string, unknown> | undefined => {
  if (text === undefined) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined
}

/** 從設定檔內容讀出主題名稱；檔案不存在（undefined）、壞掉、或名稱不在清單裡時回 undefined。 */
export const parseThemeSetting = (text: string | undefined, names: readonly string[] = THEME_NAMES): string | undefined => {
  const theme = parseObject(text)?.theme
  return typeof theme === 'string' && names.includes(theme) ? theme : undefined
}

/** 把主題寫進設定檔內容，保留其他欄位；原內容不能用時只寫主題。 */
export const withThemeSetting = (text: string | undefined, name: string): string =>
  `${JSON.stringify({ ...parseObject(text), theme: name }, null, 2)}\n`
