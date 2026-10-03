/**
 * 把綠雲與愛心原圖（放大過的像素畫）還原成 session-radar 的 Sprite。
 *
 * 步驟：
 * 1. 依 2 列 × 6 格切出 12 格；相鄰兩格可能稍微黏在一起，所以在預期邊界附近找最空的那一欄當分界。
 * 2. 推估原始像素格：先由同色連續段的長度估出像素大小（約 7.2 px），
 *    再在每格找顏色邊界集中的位置當格線（原圖格子大小不一，不能用固定週期），漏掉的格線等分補上。
 * 3. 每個像素格只看中心區域，取多數顏色（量化到調色盤，透明度低的算透明），避開邊緣的模糊混色；
 *    愛心臉上比像素還細的五官與腮紅另有規則補回。
 * 4. 用規則清除孤立雜點與鄰格黏過來的碎片，再以眼睛中心對齊左右、腳底對齊最後一列，補成同寬同高。
 */
import type { Image } from './png.ts'

/** puma 調色盤：字元 → 色碼。字元刻意避開老虎的 O K W E N G L B g H。 */
export const PUMA_PALETTE: Record<string, string> = {
  C: '#5bb987', // 綠雲身體
  Y: '#fad776', // 手腳
  I: '#fafafa', // 眼白
  X: '#111111', // 眉毛、眼珠、輪廓
  R: '#f2466a', // 愛心
  P: '#fb8ea6', // 腮紅
  D: '#8f5232', // 愛心的腳
}

/** 原圖的格數。 */
export const COLS = 6
export const ROWS = 2

/** 比這個透明度低的像素視為透明。 */
const ALPHA_MIN = 128

const rgbOf = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
const PALETTE_RGB = Object.entries(PUMA_PALETTE).map(([ch, hex]) => [ch, rgbOf(hex)] as const)

/**
 * 原圖裡各部位實際的顏色（量化時比對用），與輸出的 PUMA_PALETTE 分開：
 * 原圖的腮紅其實是比愛心略深的紅（#e4285a），在終端機上幾乎看不出來，輸出時改畫成粉紅色。
 */
const SOURCE_RGB: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['C', [90, 185, 135]],
  ['Y', [250, 215, 120]],
  ['I', [250, 250, 250]],
  ['X', [0, 0, 0]],
  ['R', [245, 70, 100]],
  ['P', [228, 40, 88]],
  ['D', [152, 88, 56]],
]

/** 單一原圖像素量化成調色盤字元，透明回傳 '.'。 */
export const quantize = (r: number, g: number, b: number, a: number): string => {
  if (a < ALPHA_MIN) return '.'
  let best = '.'
  let bestD = Number.POSITIVE_INFINITY
  for (const [ch, [pr, pg, pb]] of SOURCE_RGB) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < bestD) {
      bestD = d
      best = ch
    }
  }
  return best
}

/** 整張圖量化成字元格（每個原圖像素一個字元）。 */
export type Labels = { width: number; height: number; at: (x: number, y: number) => string }
export const labelImage = (img: Image): Labels => {
  const chars = new Array<string>(img.width * img.height)
  for (let i = 0; i < chars.length; i++) {
    const p = i * 4
    chars[i] = quantize(img.rgba[p]!, img.rgba[p + 1]!, img.rgba[p + 2]!, img.rgba[p + 3]!)
  }
  return {
    width: img.width,
    height: img.height,
    at: (x, y) => (x < 0 || y < 0 || x >= img.width || y >= img.height ? '.' : chars[y * img.width + x]!),
  }
}

export type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * 切出 12 格（第 1 列左到右，再第 2 列）。每列在等分邊界 ±SEARCH 欄內找不透明像素最少的那一欄當分界；
 * 有好幾欄一樣少時取最靠近等分點的。
 */
export const splitFrames = (lab: Labels): Box[] => {
  const SEARCH = 60
  const cellW = lab.width / COLS
  const cellH = lab.height / ROWS
  const boxes: Box[] = []
  for (let row = 0; row < ROWS; row++) {
    const y0 = Math.round(row * cellH)
    const y1 = Math.round((row + 1) * cellH)
    const count = (x: number) => {
      let c = 0
      for (let y = y0; y < y1; y++) if (lab.at(x, y) !== '.') c++
      return c
    }
    const cuts = [0]
    for (let k = 1; k < COLS; k++) {
      const mid = Math.round(k * cellW)
      let best = mid
      for (let x = mid - SEARCH; x <= mid + SEARCH; x++) {
        const better = count(x) < count(best) || (count(x) === count(best) && Math.abs(x - mid) < Math.abs(best - mid))
        if (better) best = x
      }
      cuts.push(best)
    }
    cuts.push(lab.width)
    for (let k = 0; k < COLS; k++) boxes.push({ x0: cuts[k]!, y0, x1: cuts[k + 1]!, y1 })
  }
  return boxes
}

/**
 * 原始像素的平均大小（原圖 px）：同色連續段的長度集中在像素大小的整數倍，
 * 取 5～11 px 之間最常見的長度，再與相鄰長度加權平均。
 */
export const pixelSize = (lab: Labels): number => {
  const hist = new Array<number>(12).fill(0)
  const count = (len: number, c: string) => c !== '.' && len >= 5 && len <= 11 && hist[len]!++
  for (let y = 0; y < lab.height; y += 2) {
    let run = 0
    for (let x = 0; x <= lab.width; x++) {
      if (x > 0 && x < lab.width && lab.at(x, y) === lab.at(x - 1, y)) run++
      else {
        if (x > 0) count(run, lab.at(x - 1, y))
        run = 1
      }
    }
  }
  for (let x = 0; x < lab.width; x += 2) {
    let run = 0
    for (let y = 0; y <= lab.height; y++) {
      if (y > 0 && y < lab.height && lab.at(x, y) === lab.at(x, y - 1)) run++
      else {
        if (y > 0) count(run, lab.at(x, y - 1))
        run = 1
      }
    }
  }
  const peak = hist.indexOf(Math.max(...hist))
  const near = [peak - 1, peak, peak + 1]
  const total = near.reduce((n, i) => n + hist[i]!, 0)
  return near.reduce((n, i) => n + i * hist[i]!, 0) / total
}

/**
 * 由顏色邊界找格線：edges[i] 是座標 i 與 i-1 之間顏色不同的次數。
 * AI 放大的像素畫格子大小不一（6～9 px 都有），不能用固定週期，所以：
 * 1. 取邊界次數的局部高峰，由強到弱挑，與已挑的格線距離不足 0.6 個像素就略過（模糊造成的重複邊界）。
 * 2. 頭尾加上內容的起點與終點。
 * 3. 相鄰兩條格線間距明顯超過一個像素時，等分補上漏掉的格線。
 * 回傳格線座標（遞增），相鄰兩條之間就是一個原始像素。
 */
export const gridLines = (edges: readonly number[], start: number, end: number, size: number): number[] => {
  const floor = Math.max(2, Math.max(...edges) * 0.08)
  const peaks = edges
    .map((e, i) => [i, e] as const)
    .filter(([i, e]) => i > start && i < end && e >= floor && e >= (edges[i - 1] ?? 0) && e > (edges[i + 1] ?? 0))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const lines = [start, end]
  for (const [i] of peaks) if (lines.every(l => Math.abs(l - i) >= size * 0.6)) lines.push(i)
  lines.sort((a, b) => a - b)
  const out: number[] = [lines[0]!]
  for (let k = 1; k < lines.length; k++) {
    const from = lines[k - 1]!
    const gap = lines[k]! - from
    const n = Math.max(1, Math.round(gap / size))
    for (let j = 1; j <= n; j++) out.push(from + (gap * j) / n)
  }
  return out
}

/** 一格內水平與垂直方向的顏色邊界次數（索引是原圖座標減去格子左上角）。 */
const edgesOf = (lab: Labels, box: Box): { ex: number[]; ey: number[] } => {
  const ex = new Array<number>(box.x1 - box.x0).fill(0)
  const ey = new Array<number>(box.y1 - box.y0).fill(0)
  for (let y = box.y0; y < box.y1; y++)
    for (let x = box.x0; x < box.x1; x++) {
      const c = lab.at(x, y)
      if (x > box.x0 && c !== lab.at(x - 1, y)) ex[x - box.x0]!++
      if (y > box.y0 && c !== lab.at(x, y - 1)) ey[y - box.y0]!++
    }
  return { ex, ey }
}

/** 不透明內容的範圍（相對格子左上角，終點不含）。 */
const extentOf = (lab: Labels, box: Box): Box => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (let y = box.y0; y < box.y1; y++)
    for (let x = box.x0; x < box.x1; x++)
      if (lab.at(x, y) !== '.') {
        x0 = Math.min(x0, x - box.x0)
        y0 = Math.min(y0, y - box.y0)
        x1 = Math.max(x1, x - box.x0 + 1)
        y1 = Math.max(y1, y - box.y0 + 1)
      }
  return { x0, y0, x1, y1 }
}

export type Grid = { xs: number[]; ys: number[] }

/** 推估一格的格線（原圖座標）。 */
export const frameGrid = (lab: Labels, box: Box, size: number): Grid => {
  const { ex, ey } = edgesOf(lab, box)
  const e = extentOf(lab, box)
  return {
    xs: gridLines(ex, e.x0, e.x1, size).map(v => v + box.x0),
    ys: gridLines(ey, e.y0, e.y1, size).map(v => v + box.y0),
  }
}

/** 像素格中心區域佔格子邊長的比例，避開邊緣的模糊混色。 */
const CORE = 0.5
/** 黑色常是一個像素寬的細線（眉毛、眼珠），且未必對齊格線，所以黑色以加倍票數計算。 */
const WEIGHT: Record<string, number> = { X: 2 }
/**
 * 愛心臉上的眼睛、笑臉與腮紅比原始像素還細（約半格），多數決會被紅色蓋掉。
 * 所以多數色是愛心紅時，再看整格（不只中心）：黑色佔 DETAIL_X 以上就算黑，腮紅佔 DETAIL_P 以上就算腮紅。
 */
const DETAIL_X = 0.12
const DETAIL_P = 0.25

/** 統計一塊範圍內各字元出現的次數。 */
const tallyOf = (lab: Labels, box: Box, x0: number, y0: number, x1: number, y1: number): Map<string, number> => {
  const tally = new Map<string, number>()
  for (let y = Math.max(y0, box.y0); y < Math.min(y1, box.y1); y++)
    for (let x = Math.max(x0, box.x0); x < Math.min(x1, box.x1); x++) {
      const c = lab.at(x, y)
      tally.set(c, (tally.get(c) ?? 0) + 1)
    }
  return tally
}

/** 依格線把一格還原成原始像素：每格取中心區域的多數色（平手時優先非透明），愛心內再補上細節。 */
export const sampleFrame = (lab: Labels, box: Box, grid: Grid): string[] => {
  const margin = (1 - CORE) / 2
  const core = (a: number, b: number) => {
    const lo = Math.round(a + (b - a) * margin)
    return [lo, Math.max(lo + 1, Math.round(b - (b - a) * margin))] as const
  }
  return grid.ys.slice(1).map((yb, j) => {
    const ya = grid.ys[j]!
    const [cy0, cy1] = core(ya, yb)
    return grid.xs
      .slice(1)
      .map((xb, i) => {
        const xa = grid.xs[i]!
        const [cx0, cx1] = core(xa, xb)
        let best = '.'
        let n = 0
        for (const [c, k] of tallyOf(lab, box, cx0, cy0, cx1, cy1)) {
          const w = k * (WEIGHT[c] ?? 1)
          if (w > n || (w === n && best === '.')) [best, n] = [c, w]
        }
        if (best !== 'R') return best
        const whole = tallyOf(lab, box, Math.ceil(xa), Math.ceil(ya), Math.floor(xb), Math.floor(yb))
        const total = [...whole.values()].reduce((a, b) => a + b, 0)
        if ((whole.get('X') ?? 0) >= total * DETAIL_X) return 'X'
        if ((whole.get('P') ?? 0) >= total * DETAIL_P) return 'P'
        return best
      })
      .join('')
  })
}

const at = (s: readonly string[], x: number, y: number): string => s[y]?.[x] ?? '.'

/** 被同色包住也要保留的單點：眼白裡的眼珠、愛心臉上的五官與腮紅。 */
const KEEP_INSIDE: Record<string, string> = { I: 'X', R: 'XP' }

/**
 * 清除雜點：
 * - 與四周（8 方向）都不相連的單點，直接變透明（多半是邊界切割或混色殘渣）。
 * - 上下左右四個鄰居都是同一種顏色、只有自己不同的單點，改成那個顏色（混色造成的誤判）；
 *   KEEP_INSIDE 列出的刻意單點除外。
 * - 腮紅只會在愛心裡面：碰到透明或輪廓的腮紅是紅黑交界的混色，改回愛心紅。
 */
export const cleanup = (s: readonly string[]): string[] =>
  s.map((row, y) =>
    [...row]
      .map((c, x) => {
        if (c === '.') return c
        const n8 = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (dx || dy ? at(s, x + dx, y + dy) : '.')))
        if (n8.every(n => n === '.')) return '.'
        const n4 = [at(s, x, y - 1), at(s, x, y + 1), at(s, x - 1, y), at(s, x + 1, y)]
        if (c === 'P' && n4.some(n => n === '.' || n === 'X')) return 'R'
        const around = n4[0]!
        if (n4.every(n => n === around) && around !== c && !(KEEP_INSIDE[around] ?? '').includes(c)) return around
        return c
      })
      .join(''),
  )

/**
 * 去掉鄰格黏過來的碎片：以 8 方向相連的不透明像素為一塊，
 * 輪廓以外的顏色少於 minFill 個的塊（只有一小段黑線或幾個混色點）整塊變透明。
 */
export const dropStrays = (s: readonly string[], minFill = 3): string[] => {
  const h = s.length
  const w = s[0]?.length ?? 0
  const label = new Array<number>(w * h).fill(-1)
  const fills: number[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (at(s, x, y) === '.' || label[y * w + x]! >= 0) continue
      const id = fills.length
      let fill = 0
      const stack: [number, number][] = [[x, y]]
      label[y * w + x] = id
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!
        if (at(s, cx, cy) !== 'X') fill++
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx
            const ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || at(s, nx, ny) === '.' || label[ny * w + nx]! >= 0) continue
            label[ny * w + nx] = id
            stack.push([nx, ny])
          }
      }
      fills.push(fill)
    }
  return s.map((row, y) => [...row].map((c, x) => (c !== '.' && fills[label[y * w + x]!]! < minFill ? '.' : c)).join(''))
}

/** 去掉四周全透明的列與欄。 */
export const trim = (s: readonly string[]): string[] => {
  const rows = s.map((r, y) => [r, y] as const).filter(([r]) => /[^.]/.test(r)).map(([, y]) => y)
  if (rows.length === 0) return []
  const cols = [...(s[0] ?? '')].map((_, x) => x).filter(x => s.some(r => (r[x] ?? '.') !== '.'))
  return s.slice(rows[0], rows.at(-1)! + 1).map(r => r.slice(cols[0], cols.at(-1)! + 1))
}

/** 眼白的水平中心（欄），用來左右對齊各格。 */
export const eyeCenter = (s: readonly string[]): number => {
  let sum = 0
  let n = 0
  s.forEach(row => [...row].forEach((c, x) => c === 'I' && ((sum += x), n++)))
  return n === 0 ? (s[0]?.length ?? 0) / 2 : sum / n
}

/** 以眼睛中心對齊、腳底對齊最後一列，補成同寬同高。 */
export const align = (frames: readonly (readonly string[])[]): string[][] => {
  const anchors = frames.map(f => Math.round(eyeCenter(f)))
  const left = Math.max(...anchors)
  const right = Math.max(...frames.map((f, i) => (f[0]?.length ?? 0) - anchors[i]!))
  const height = Math.max(...frames.map(f => f.length))
  const width = left + right
  return frames.map((f, i) => {
    const pad = left - anchors[i]!
    const rows = f.map(r => '.'.repeat(pad) + r + '.'.repeat(width - pad - r.length))
    return [...Array.from({ length: height - f.length }, () => '.'.repeat(width)), ...rows]
  })
}

export type Conversion = { frames: string[][]; grids: Grid[]; boxes: Box[]; size: number }

/** 整個轉換流程：原圖 → 12 格同寬同高的 Sprite。 */
export const convert = (img: Image): Conversion => {
  const lab = labelImage(img)
  const boxes = splitFrames(lab)
  const size = pixelSize(lab)
  const grids = boxes.map(b => frameGrid(lab, b, size))
  const raw = boxes.map((b, i) => trim(dropStrays(cleanup(sampleFrame(lab, b, grids[i]!)))))
  return { frames: align(raw), grids, boxes, size }
}

/** 產生檔的路徑（相對 repo 根目錄），寫在檔頭提醒不要手改。 */
export const OUTPUT = 'session-radar/hooks/puma-sprites.ts'

/** 把 12 格走路圖寫成 mod 原始碼（與老虎相同的 Sprite 格式）。 */
export const sourceOf = (frames: readonly (readonly string[])[]): string => {
  const palette = Object.entries(PUMA_PALETTE)
    .map(([ch, hex]) => `  ${ch}: '${hex}',`)
    .join('\n')
  const walk = frames.map(f => `  [\n${f.map(r => `    '${r}',`).join('\n')}\n  ],`).join('\n')
  return `/**
 * 綠雲與愛心（puma 主題）的像素圖：每個字元是一個像素，'.' 為透明。
 * 此檔由 scripts/gen-puma.ts 從 scripts/assets/green-cloud-and-heart.png 產生，請勿手改；
 * 要調整請改腳本後執行 node scripts/gen-puma.ts。
 */
type Sprite = readonly string[]

/** puma 調色盤：C 綠雲、Y 手腳、I 眼白、X 眉毛與輪廓、R 愛心、P 腮紅、D 愛心的腳。 */
export const PUMA_PALETTE: Record<string, string> = {
${palette}
}

/** 走路 12 格（原圖第 1 列左到右，再第 2 列），角色朝左；第 12 格沒有愛心。 */
export const PUMA_WALK: readonly Sprite[] = [
${walk}
]
`
}

/** 預覽圖：每組 Sprite 一列一列排開，每個像素畫成 px 見方，背景用面板的深灰色。 */
export const previewImage = (groups: readonly (readonly (readonly string[])[])[], px: number, perRow: number): Image => {
  const GAP = 2
  const BG = [0x1e, 0x1e, 0x1e]
  const cell = (list: readonly (readonly string[])[]) => ({
    w: Math.max(...list.map(s => s[0]?.length ?? 0)),
    h: Math.max(...list.map(s => s.length)),
  })
  const layout = groups.map(g => ({ g, ...cell(g), rows: Math.ceil(g.length / perRow) }))
  const width = (Math.max(...layout.map(l => Math.min(perRow, l.g.length) * (l.w + GAP))) + GAP) * px
  const height = (layout.reduce((n, l) => n + l.rows * (l.h + GAP), 0) + GAP) * px
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) rgba.set([...BG, 255], i * 4)
  const colors = Object.fromEntries(PALETTE_RGB)
  let top = GAP
  for (const l of layout) {
    l.g.forEach((s, i) => {
      const ox = GAP + (i % perRow) * (l.w + GAP)
      const oy = top + Math.floor(i / perRow) * (l.h + GAP) + (l.h - s.length)
      s.forEach((row, y) =>
        [...row].forEach((c, x) => {
          const rgb = colors[c]
          if (!rgb) return
          for (let dy = 0; dy < px; dy++)
            for (let dx = 0; dx < px; dx++) rgba.set([...rgb, 255], (((oy + y) * px + dy) * width + (ox + x) * px + dx) * 4)
        }),
      )
    })
    top += l.rows * (l.h + GAP)
  }
  return { width, height, rgba }
}
