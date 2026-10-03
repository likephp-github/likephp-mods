/** 8-bit 老虎：每個字元是一個像素，'.' 為透明。 */
export type Sprite = readonly string[]

export const PALETTE: Record<string, string> = {
  O: '#f08a24', // 橘色毛
  K: '#3b2410', // 深色條紋
  W: '#f5efe2', // 白色肚子、嘴邊
  E: '#111111', // 眼睛
  N: '#ff8fa3', // 鼻子
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

export const spriteWidth = (s: Sprite): number => s[0]?.length ?? 0

/** 整數倍放大（最近鄰），保持像素風。 */
export const scale = (s: Sprite, k: number): Sprite =>
  s.flatMap(row => {
    const wide = [...row].map(px => px.repeat(k)).join('')
    return Array.from({ length: k }, () => wide)
  })

/** 左右翻轉，讓老虎往左走。 */
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

export const MIN_FACTOR = 1
export const MAX_FACTOR = 3

/**
 * 上下文 100% 時的倍數：最多 3 倍，且不超過面板能容納的整數倍。
 * 其他用量依比例縮小，最小 1 倍（再小就看不出是老虎）；還沒有用量時用最小值。
 */
export const factorFor = (percent: number | undefined, columns: number, width: number): number => {
  const full = Math.max(1, Math.min(MAX_FACTOR, Math.floor(columns / width)))
  if (percent === undefined) return MIN_FACTOR
  const ratio = Math.min(100, Math.max(0, percent)) / 100
  return Math.max(MIN_FACTOR, full * ratio)
}

/** 依倍數縮放姿勢，寬高至少 1 像素。 */
export const sized = (s: Sprite, factor: number): Sprite =>
  resize(s, Math.max(1, Math.round(spriteWidth(s) * factor)), Math.max(1, Math.round(s.length * factor)))

export type Run = { text: string; fg?: string; bg?: string }

/** 每兩列像素合成一列半格字元（▀ ▄），相同顏色的相鄰格併成一段。 */
export const toRuns = (s: Sprite): Run[][] => {
  const lines: Run[][] = []
  for (let y = 0; y < s.length; y += 2) {
    const top = s[y] ?? ''
    const bottom = s[y + 1] ?? ''
    const runs: Run[] = []
    for (let x = 0; x < top.length; x++) {
      const t = PALETTE[top[x] ?? '.']
      const b = PALETTE[bottom[x] ?? '.']
      const cell: Run =
        t === undefined && b === undefined
          ? { text: ' ' }
          : t === undefined
            ? { text: '▄', fg: b }
            : { text: '▀', fg: t, bg: b }
      const last = runs[runs.length - 1]
      if (last !== undefined && last.fg === cell.fg && last.bg === cell.bg && (last.text[0] === cell.text)) {
        last.text += cell.text
      } else {
        runs.push({ ...cell })
      }
    }
    lines.push(runs)
  }
  return lines
}

export type Walker = { x: number; facing: 1 | -1 }

/** 往前走一步，碰到邊界就轉身。 */
export const step = (w: Walker, room: number, stride: number): Walker => {
  const max = Math.max(0, room)
  const next = w.x + w.facing * stride
  if (next > max) return { x: max, facing: -1 }
  if (next < 0) return { x: 0, facing: 1 }
  return { x: next, facing: w.facing }
}

const ZZZ = ['z', 'z Z', 'z Z z', '']

export const snore = (frame: number): string => ZZZ[Math.floor(frame / 2) % ZZZ.length] ?? ''

export type Mode = 'walk' | 'play' | 'sleep'

/** 閒置多久後才睡覺。 */
export const NAP_AFTER_MS = 30_000

export const modeFor = (isWorking: boolean, idleSince: number, now: number): Mode => {
  if (isWorking) return 'walk'
  return idleSince > 0 && now - idleSince < NAP_AFTER_MS ? 'play' : 'sleep'
}

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
