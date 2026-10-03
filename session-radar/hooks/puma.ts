/**
 * 綠雲與愛心主題（puma）：工作中左右來回走，回覆結束後頭頂冒出 ♥ 與一句名言，閒置久了吃三色丸子。
 * 背景是閃爍的星空，沒有地面；角色腳底貼著面板底部。
 */
import { DANGO } from './dango'
import type { FrameInput, Mark } from './frame'
import { PUMA_PALETTE, PUMA_WALK } from './puma-sprites'
import { overlay } from './scene'
import { mirror, sized, spriteWidth } from './sprite'
import type { Sprite } from './sprite'
import { starField, starMarks } from './stars'
import { displayWidth, wrapText } from './text'
import type { Act, Placed, Theme } from './theme'

/** 名言（原文照用）。 */
export const QUOTES: readonly string[] = [
  '我們不要灰心，我們也不應該喪志，為什麼？因為我來了。',
  '人類的讚歌就是勇氣的讚歌，我們會把勇氣繼續傳承下去。',
  '如果有人說懷抱希望是一種錯誤，那麼我會每一次都反駁他。無論幾次，我都會堅定地說。',
  '未來的事情無人知，但就是因為這樣，可能性才會如此強大。',
  '我本來就不是以外表取勝。',
  '洋流是溫暖的，可以帶來漁獲，不會燙傷人。',
]

/** 這段 resting 的名言：由進入 resting 時抽的亂數決定，期間不換；沒有亂數時用第一句。 */
export const quoteFor = (seed: number | undefined): string =>
  QUOTES[Math.min(QUOTES.length - 1, Math.max(0, Math.floor((seed ?? 0) * QUOTES.length)))] ?? ''

/** 名言最多幾行。 */
export const QUOTE_LINES = 3

/** 原圖朝左；主題的姿勢一律面向右，所以先翻轉。 */
const faceRight = (s: Sprite): Sprite => mirror(s)

/** 走路圖（面向右）。 */
export const WALK: readonly Sprite[] = PUMA_WALK.map(faceRight)

/** 停下來時的站姿：固定用走路的第 1 格（朝左原圖）。 */
const STAND = PUMA_WALK[0] ?? []

/** 丸子疊在原圖（朝左）的哪個位置：竹籤尾端插在前面那隻黃色手的上緣。 */
export const DANGO_AT = { x: 2, y: 7 }

/** 丸子每個階段維持幾格。 */
export const DANGO_FRAMES = 4

/** 第 frame 格丸子吃到第幾階段：0～3 依序剩 3、2、1、0 顆，之後換新的一串。 */
export const dangoStage = (frame: number): number => Math.floor(frame / DANGO_FRAMES) % DANGO.length

/** 吃丸子的姿勢（面向右）：站姿的手上疊著這個階段的丸子。 */
export const eatPose = (frame: number): Sprite =>
  faceRight(overlay(STAND, DANGO[dangoStage(frame)] ?? [], DANGO_AT.x, DANGO_AT.y))

/**
 * 白色眼睛區塊裡有黑色像素：某個黑色像素左右或上下都是眼白。
 * 縮到最小時眼白整塊變白（眼珠被取樣掉）就不成立。
 */
export const hasPupil = (s: Sprite): boolean =>
  s.some((row, y) =>
    [...row].some(
      (px, x) => px === 'X' && ((row[x - 1] === 'I' && row[x + 1] === 'I') || (s[y - 1]?.[x] === 'I' && s[y + 1]?.[x] === 'I')),
    ),
  )

/** 最小倍數的起點；實際值會為了看得到黑眼珠往上調。 */
export const BASE_MIN_FACTOR = 0.5

/** 調高倍數時每次加多少。 */
const FIT_STEP = 0.01

const fitted = new Map<number, number>()

/**
 * 保底：縮放後 12 格走路圖都還看得到黑眼珠。縮放是最近鄰取樣，
 * 某些倍數剛好會把眼珠取樣掉；這時往上加到 12 格都看得到為止。
 * 檢查的是面板實際縮放的姿勢（面向右的版本），先翻轉再縮放取到的像素不一樣。
 */
export const eyeSafe = (factor: number): number => {
  const cached = fitted.get(factor)
  if (cached !== undefined) return cached
  let f = factor
  for (let i = 0; i < 100 && !WALK.every(p => hasPupil(sized(p, f))); i++) f = Math.round((f + FIT_STEP) * 1000) / 1000
  fitted.set(factor, f)
  return f
}

export const MIN_FACTOR = eyeSafe(BASE_MIN_FACTOR)

/** 頭頂最多留幾行給對話框：名言 3 行加 ♥ 一行。 */
export const HEAD_LINES = QUOTE_LINES + 1

const evenUp = (n: number): number => n + (n % 2)

/** 角色在場景裡佔的範圍（文字行）：最上面有顏色的那一行到場景底部。 */
type Figure = { head: number; bottom: number; drawn: boolean }

const figureOf = (pose: Sprite, o: FrameInput, at: Placed): Figure => {
  const sizedPose = sized(pose, o.factor)
  const firstRow = Math.max(0, sizedPose.findIndex(row => /[^.]/.test(row)))
  return {
    head: Math.floor((at.top + firstRow) / 2),
    bottom: Math.ceil((at.top + sizedPose.length) / 2),
    drawn: at.width <= o.columns,
  }
}

/** 頭頂的文字：一行一個 Mark，每行以角色為中心，碰到面板邊緣往內推。 */
const centered = (o: FrameInput, at: Placed, line: number, text: string, color: string): Mark => {
  const width = displayWidth(text)
  const center = at.x + Math.floor(at.width / 2)
  const col = Math.max(0, Math.min(center - Math.floor(width / 2), o.columns - width))
  return { line, col, text, color }
}

/**
 * 對話框：頭頂上一行是 ♥，名言在 ♥ 上面。
 * 頭頂的行數不夠時依序讓出：名言 3 行 → 1 行 → 不顯示名言只留 ♥ → 什麼都不畫。
 */
export const bubble = (o: FrameInput, at: Placed, head: number): Mark[] => {
  if (head < 1) return []
  const heart = centered(o, at, head - 1, '♥', 'redBright')
  const room = head - 1
  const maxLines = room >= QUOTE_LINES ? QUOTE_LINES : room >= 1 ? 1 : 0
  const lines = wrapText(`「${quoteFor(o.seed)}」`, o.columns, maxLines)
  const top = head - 1 - lines.length
  return [...lines.map((text, i) => centered(o, at, top + i, text, 'white')), heart]
}

/** 星空：避開角色與頭頂文字佔用的格子；文字左右各多留一格，星星不會黏在字旁邊。 */
const sky = (o: FrameInput, at: Placed, fig: Figure, over: readonly Mark[]): Mark[] => {
  const used = new Set(over.flatMap(m => Array.from({ length: displayWidth(m.text) + 2 }, (_, i) => `${m.line},${m.col - 1 + i}`)))
  const onFigure = (line: number, col: number) => fig.drawn && line >= fig.head && col >= at.x && col < at.x + at.width
  return starMarks(starField(o.columns, fig.bottom), o.frame, (line, col) => onFigure(line, col) || used.has(`${line},${col}`))
}

/** 動作：pose 之外，符號一律是「頭頂文字＋避開它們的星空」。 */
const act = (pose: (frame: number) => Sprite, overhead: (o: FrameInput, at: Placed, head: number) => Mark[]): Act => ({
  pose,
  marks: (o, at) => {
    const fig = figureOf(pose(o.frame), o, at)
    const over = fig.drawn ? overhead(o, at, fig.head) : []
    return [...sky(o, at, fig, over), ...over]
  },
})

/** 吃到剩 2 顆時頭頂冒出 nom。 */
const nom = (o: FrameInput, at: Placed, head: number): Mark[] =>
  dangoStage(o.frame) === 1 && head >= 1 ? [centered(o, at, head - 1, 'nom', 'yellow')] : []

export const puma: Theme = {
  name: 'puma',
  acts: {
    working: act(frame => WALK[frame % WALK.length] ?? [], () => []),
    resting: act(() => faceRight(STAND), bubble),
    idle: act(eatPose, nom),
  },
  // 星空不畫在像素圖上；場景只有角色，腳底貼底，頭頂最多留 HEAD_LINES 行。面板比角色窄時不畫角色。
  compose: o => {
    const body = evenUp(o.pose.length)
    const head = Math.max(0, Math.min(HEAD_LINES, o.rows - body / 2))
    const height = head * 2 + body
    const top = height - o.pose.length
    const empty: Sprite = Array.from({ length: height }, () => '.'.repeat(o.columns))
    return { sprite: spriteWidth(o.pose) <= o.columns ? overlay(empty, o.pose, o.x, top) : empty, top }
  },
  palette: PUMA_PALETTE,
  width: spriteWidth(STAND),
  minFactor: MIN_FACTOR,
  fit: factor => eyeSafe(Math.max(MIN_FACTOR, factor)),
}
