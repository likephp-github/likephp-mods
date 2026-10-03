/** 像素圖的共用工具：縮放、翻轉、轉成半格字元、在畫面上寫字。與主題無關。 */
import { charWidth } from './text'

/** 像素圖：每個字元是一個像素，'.' 為透明；顏色由主題的調色盤決定。 */
export type Sprite = readonly string[]

export const spriteWidth = (s: Sprite): number => s[0]?.length ?? 0

/** 整數倍放大（最近鄰），保持像素風。 */
export const scale = (s: Sprite, k: number): Sprite =>
  s.flatMap(row => {
    const wide = [...row].map(px => px.repeat(k)).join('')
    return Array.from({ length: k }, () => wide)
  })

/** 左右翻轉，讓角色往左走。 */
export const mirror = (s: Sprite): Sprite => s.map(row => [...row].reverse().join(''))

/** 最近鄰縮放到指定像素寬高，可放大也可縮小。 */
export const resize = (s: Sprite, width: number, height: number): Sprite => {
  const srcH = s.length
  const srcW = spriteWidth(s)
  return Array.from({ length: height }, (_, y) => {
    const row = s[Math.min(srcH - 1, Math.floor((y * srcH) / height))] ?? ''
    return Array.from({ length: width }, (_, x) => row[Math.min(srcW - 1, Math.floor((x * srcW) / width))] ?? '.').join('')
  })
}

export const MAX_FACTOR = 3
/** 整體縮小比例：依用量算出的大小再乘上這個值。 */
export const SIZE_SCALE = 0.5

/**
 * 上下文 100% 時的倍數：面板能容納的整數倍（最多 3 倍）再乘上 SIZE_SCALE。
 * 其他用量依比例縮小，最小為主題的最小倍數；還沒有用量時用最小值。
 * width 是角色 1 倍時的像素寬。
 */
export const factorFor = (percent: number | undefined, columns: number, size: { width: number; minFactor: number }): number => {
  const full = Math.max(1, Math.min(MAX_FACTOR, Math.floor(columns / size.width)))
  if (percent === undefined) return size.minFactor
  const ratio = Math.min(100, Math.max(0, percent)) / 100
  return Math.max(size.minFactor, full * ratio * SIZE_SCALE)
}

/** 依倍數縮放姿勢，寬高至少 1 像素。 */
export const sized = (s: Sprite, factor: number): Sprite =>
  resize(s, Math.max(1, Math.round(spriteWidth(s) * factor)), Math.max(1, Math.round(s.length * factor)))

export type Run = { text: string; fg?: string; bg?: string }

/** 每兩列像素合成一列半格字元（▀ ▄），每格一個 Run；palette 是主題的調色盤。 */
export const toCells = (s: Sprite, palette: Record<string, string>): Run[][] => {
  const lines: Run[][] = []
  for (let y = 0; y < s.length; y += 2) {
    const top = s[y] ?? ''
    const bottom = s[y + 1] ?? ''
    lines.push(
      [...top].map((px, x) => {
        const t = palette[px]
        const b = palette[bottom[x] ?? '.']
        if (t === undefined && b === undefined) return { text: ' ' }
        if (t === undefined) return { text: '▄', fg: b }
        return b === undefined ? { text: '▀', fg: t } : { text: '▀', fg: t, bg: b }
      }),
    )
  }
  return lines
}

/** 相同顏色、相同字元的相鄰格併成一段。 */
export const joinCells = (lines: readonly (readonly Run[])[]): Run[][] =>
  lines.map(cells => {
    const runs: Run[] = []
    for (const cell of cells) {
      const last = runs[runs.length - 1]
      if (last !== undefined && last.fg === cell.fg && last.bg === cell.bg && last.text[0] === cell.text) {
        last.text += cell.text
      } else {
        runs.push({ ...cell })
      }
    }
    return runs
  })

export const toRuns = (s: Sprite, palette: Record<string, string>): Run[][] => joinCells(toCells(s, palette))

/**
 * 在第 line 行第 at 欄寫字；底色用該格下半像素的顏色，空白不蓋背景。
 * 寬字元（中文）佔兩格：字放在第一格，第二格清成空字串；放不下整個字就不畫。
 */
export const stamp = (
  cells: readonly (readonly Run[])[],
  s: Sprite,
  line: number,
  at: number,
  text: string,
  color: string,
  palette: Record<string, string>,
): Run[][] =>
  cells.map((row, l) => {
    if (l !== line) return [...row]
    const out = [...row]
    let col = at
    for (const ch of text) {
      const width = charWidth(ch)
      const fits = col >= 0 && col + width <= out.length
      if (ch !== ' ' && fits) {
        const bg = palette[s[line * 2 + 1]?.[col] ?? '.']
        out[col] = bg === undefined ? { text: ch, fg: color } : { text: ch, fg: color, bg }
        if (width === 2) out[col + 1] = { text: '' }
      }
      col += width
    }
    return out
  })

export type Walker = { x: number; facing: 1 | -1 }

/** 往前走一步，碰到邊界就轉身。 */
export const step = (w: Walker, room: number, stride: number): Walker => {
  const max = Math.max(0, room)
  const next = w.x + w.facing * stride
  if (next > max) return { x: max, facing: -1 }
  if (next < 0) return { x: 0, facing: 1 }
  return { x: next, facing: w.facing }
}
