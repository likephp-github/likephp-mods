/** 文字在終端機上的顯示寬度與換行：中日韓全形字佔 2 欄，其他佔 1 欄。與主題無關。 */

/** 佔 2 欄的字元範圍（East Asian Wide / Fullwidth 的常用區段）。 */
const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], // 韓文字母
  [0x2e80, 0x303e], // 部首、CJK 標點（「」。、）
  [0x3041, 0x33ff], // 假名、注音、CJK 相容字元
  [0x3400, 0x4dbf], // CJK 擴充 A
  [0x4e00, 0x9fff], // CJK 統一漢字
  [0xa000, 0xa4cf], // 彝文
  [0xac00, 0xd7a3], // 韓文音節
  [0xf900, 0xfaff], // CJK 相容漢字
  [0xfe30, 0xfe4f], // CJK 相容標點
  [0xff00, 0xff60], // 全形英數與標點（，？！）
  [0xffe0, 0xffe6], // 全形符號
  [0x20000, 0x3fffd], // CJK 擴充 B 以後
]

/** 單一字元（code point）的顯示寬度。 */
export const charWidth = (ch: string): 1 | 2 => {
  const code = ch.codePointAt(0) ?? 0
  return WIDE.some(([from, to]) => code >= from && code <= to) ? 2 : 1
}

/** 字串的顯示寬度。 */
export const displayWidth = (text: string): number => [...text].reduce((sum, ch) => sum + charWidth(ch), 0)

export const ELLIPSIS = '…'

/**
 * 以字為單位換行：每行顯示寬度不超過 width，寬字元不會被切成兩半。
 * 超過 maxLines 行時只留前 maxLines 行，最後一行以 … 結尾（必要時再拿掉字讓出位置）。
 * width 放不下任何一個字時回傳空陣列。
 */
export const wrapText = (text: string, width: number, maxLines: number): string[] => {
  if (maxLines <= 0 || [...text].some(ch => charWidth(ch) > width)) return []
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (displayWidth(line + ch) > width) {
      lines.push(line)
      line = ''
    }
    line += ch
  }
  if (line !== '') lines.push(line)
  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] ?? ''
  while (last !== '' && displayWidth(last + ELLIPSIS) > width) last = [...last].slice(0, -1).join('')
  kept[maxLines - 1] = last + ELLIPSIS
  return kept
}
