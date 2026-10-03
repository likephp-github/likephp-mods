/** 小老虎主題（預設）：8-bit 老虎、樹林與草地背景，工作中巡邏、閒置時抓蝴蝶、久了睡覺。 */
import type { FrameInput, Mark } from './frame'
import { composeScene, fitsTrees } from './scene'
import { spriteWidth } from './sprite'
import type { Sprite } from './sprite'
import type { Placed, Theme } from './theme'

/** 老虎與樹林草地的顏色。 */
export const PALETTE: Record<string, string> = {
  O: '#f08a24', // 橘色毛
  K: '#3b2410', // 深色條紋
  W: '#f5efe2', // 白色肚子、嘴邊
  E: '#111111', // 眼睛
  N: '#ff8fa3', // 鼻子
  G: '#2e7d32', // 樹冠
  L: '#43a047', // 樹冠亮面
  B: '#6d4c41', // 樹幹
  g: '#7cc242', // 草
  H: '#4e9a2f', // 草的暗面
}

const BODY = [
  '............OO..OO',
  '............OOKKOO',
  'K...........OEOOEO',
  '.O..OOOOOOOOOWNNWO',
  '..OOKOOKOOKOOOWWW.',
  '...OKOOKOOKOOOO...',
  '...OWWWWWWWWWOO...',
]

export const WALK: readonly Sprite[] = [
  [
    ...BODY,
    '...O.O......O.O...',
    '..O...O....O...O..',
    '..W...W....W...W..',
  ],
  [
    ...BODY,
    '....OO......OO....',
    '....OO......OO....',
    '....WW......WW....',
  ],
]

/** 站著抓蝴蝶：0 四腳站好，1 舉起前掌。 */
export const PLAY: readonly Sprite[] = [
  WALK[1] ?? [],
  [
    ...BODY.slice(0, 4),
    '..OOKOOKOOKOOOWWWW',
    '...OKOOKOOKOOOO.OO',
    '...OWWWWWWWWWOOO..',
    '....OO......O.....',
    '....OO......O.....',
    '....WW......W.....',
  ],
]

/** 尾巴往後平甩：把翹起的尾巴改成水平。 */
const swish = (s: Sprite): Sprite =>
  s.map((row, y) => (y === 2 ? '.' + row.slice(1) : y === 3 ? '..' + row.slice(2) : y === 4 ? 'KO' + row.slice(2) : row))

const STAND = PLAY[0] ?? []

/** 壓低身體準備撲：整隻往下一列，腿縮短。 */
const CROUCH: Sprite = [
  '..................',
  ...BODY,
  '....OO......OO....',
  '....WW......WW....',
]

/** 跳起來拍：舉起前掌，四腳離地一列。 */
const POUNCE: Sprite = [
  ...(PLAY[1] ?? []).slice(0, 7),
  '....OO......O.....',
  '....WW......W.....',
  '..................',
]

/**
 * 抓蝴蝶時每一步的姿勢，與蝴蝶的飛行步驟一一對應：
 * 盯著看甩尾 → 壓低身體扭屁股 → 跳起來拍 → 落地舉掌 → 甩尾看牠飛走。
 */
export const PLAY_STEPS: readonly Sprite[] = [
  STAND,
  swish(STAND),
  CROUCH,
  swish(CROUCH),
  POUNCE,
  PLAY[1] ?? STAND,
  swish(STAND),
  STAND,
]

export const SLEEP: Sprite = [
  '............OO..OO',
  '............OOKKOO',
  '..OOOOOOOOOOOKOOKO',
  '.OOKOOKOOKOOOWNNWO',
  'OKOOOOOOOOOOOOWWW.',
  '..OOOOOOOOOOWWWW..',
]

/** 把某一列換成新內容。 */
const withRow = (s: Sprite, y: number, row: string): Sprite => s.map((r, i) => (i === y ? row : r))

/** 吸氣：背部鼓起一列。 */
const inhale = (s: Sprite): Sprite => withRow(s, 1, '....OOOOOOO.OOKKOO')

/** 尾巴尖翹起來抖一下。 */
const flick = (s: Sprite): Sprite =>
  withRow(withRow(s, 3, 'KOOKOOKOOKOOOWNNWO'), 4, '.OOOOOOOOOOOOOWWW.')

/** 後面那隻耳朵抖一下（折下去）。 */
const twitch = (s: Sprite): Sprite => withRow(s, 0, '............OO....')

/** 睡覺動作一輪的格數（每格 0.4 秒）。 */
export const SLEEP_CYCLE = 16

/**
 * 第 frame 格的睡姿：每 1.2 秒一吸一吐，
 * 每輪中段尾巴抖兩格，接近尾聲耳朵抖一格。
 */
export const sleepPose = (frame: number): Sprite => {
  const step = frame % SLEEP_CYCLE
  const breath = Math.floor(frame / 3) % 2 === 1 ? inhale(SLEEP) : SLEEP
  const tail = step === 8 || step === 9 ? flick(breath) : breath
  return step === 13 ? twitch(tail) : tail
}

/** 老虎的最小倍數。 */
export const MIN_FACTOR = 0.5

const ZZZ = ['z', 'z Z', 'z Z z', '']

export const snore = (frame: number): string => ZZZ[Math.floor(frame / 2) % ZZZ.length] ?? ''

/** 前掌在原始圖裡的像素列（第 6 列，從 0 起算第 5 列）。 */
export const PAW_ROW = 5

/**
 * 蝴蝶一輪飛行的每一步（每步一格動畫）：從頭頂飛下來、停到掌邊被拍到、再逃走。
 * row 為 'above' 時在老虎頭頂那一行；否則是相對前掌那一行的列差。
 * col 是離老虎身體前緣的欄數，hit 表示這一步被拍到、老虎舉起前掌。
 */
const FLIGHT: readonly { row: 'above' | number; col: number; hit?: boolean }[] = [
  { row: 'above', col: 5 },
  { row: 'above', col: 3 },
  { row: -1, col: 3 },
  { row: -1, col: 1 },
  { row: 0, col: 0, hit: true },
  { row: 0, col: 1, hit: true },
  { row: -1, col: 4 },
  { row: 'above', col: 6 },
]

export type Flight = { row: number; col: number; glyph: string; isHit: boolean }

/**
 * 第 frame 格時蝴蝶的位置。row 已換算成老虎圖的文字列（-1 為頭頂那行），
 * pawLine 是前掌所在的文字列。
 */
export const flight = (frame: number, pawLine: number): Flight => {
  const at = FLIGHT[frame % FLIGHT.length] ?? { row: 'above', col: 5 }
  const row = at.row === 'above' ? -1 : Math.max(-1, pawLine + at.row)
  const isHit = at.hit === true
  return { row, col: at.col, isHit, glyph: isHit ? '*' : frame % 2 === 0 ? 'ʚɞ' : '><' }
}

/** 抓蝴蝶時，蝴蝶需要的前方空間（欄）。 */
export const FLIGHT_ROOM = 8

/** 抓蝴蝶時讓出前方空間給蝴蝶。 */
const placeForPlay = (o: FrameInput, width: number): number =>
  o.facing === 1
    ? Math.max(0, Math.min(o.x, o.columns - width - FLIGHT_ROOM))
    : Math.min(Math.max(0, o.columns - width), Math.max(o.x, FLIGHT_ROOM))

/** 睡覺時打呼：靠老虎右緣、在頭頂那一行；符號直接蓋在背景上。 */
const snoreMarks = (o: FrameInput, at: Placed): Mark[] => {
  const text = snore(o.frame)
  const col = Math.min(Math.max(0, at.x + at.width - text.length), o.columns - text.length)
  return [{ line: at.line - 1, col, text, color: 'cyan' }]
}

/** 抓蝴蝶時蝴蝶在頭頂或掌邊。 */
const butterflyMarks = (o: FrameInput, at: Placed): Mark[] => {
  const pawLine = Math.floor((at.top + Math.floor(PAW_ROW * o.factor)) / 2)
  const fly = flight(o.frame, pawLine - at.line)
  // 蝴蝶的欄位：老虎面向哪邊，就在那一側的身體前緣外
  const col = o.facing === 1 ? at.x + at.width + fly.col : at.x - fly.glyph.length - fly.col
  return [{ line: at.line + fly.row, col, text: fly.glyph, color: fly.isHit ? 'yellow' : 'magenta' }]
}

export const tiger: Theme = {
  name: 'tiger',
  acts: {
    working: { pose: frame => WALK[frame % WALK.length] ?? SLEEP },
    resting: { pose: frame => PLAY_STEPS[frame % PLAY_STEPS.length] ?? SLEEP, place: placeForPlay, marks: butterflyMarks },
    idle: { pose: sleepPose, marks: snoreMarks },
  },
  // 老虎疊在樹林前、站在草地上；放不下含樹的場景時只畫草
  compose: o => composeScene({ pose: o.pose, x: o.x, columns: o.columns, withTrees: fitsTrees(o.rows, 0, o.pose.length) }),
  palette: PALETTE,
  width: spriteWidth(SLEEP),
  minFactor: MIN_FACTOR,
}
