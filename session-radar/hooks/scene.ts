/** 老虎身後的樹林與腳下的草地：同樣是像素圖，'.' 為透明。 */
import { PALETTE, spriteWidth } from './tiger'
import type { Run, Sprite } from './tiger'

/** 樹林圖磚：一棵圓樹、一棵松樹與一段空地，橫向無限重複。 */
export const TREES: Sprite = [
  '..GGG..........G........',
  '.GGLGG........GGG.......',
  'GGGGGLG.......GLG.......',
  'GLGGGGG......GGGGG......',
  '.GGGGG........GGG.......',
  '...B.........GGLGG......',
  '...B...........B........',
  '..BBB..........B........',
]

/** 草地圖磚：剛好一行文字（兩列像素）。 */
export const GRASS: Sprite = [
  '.g...H..g..g',
  'gggHgggggHgg',
]

/** 樹固定高度，不隨老虎縮放，當作比例尺。 */
export const TREE_HEIGHT = TREES.length

/** 頭頂留給打呼與蝴蝶的像素列數（一行文字）。 */
const HEADROOM = 2

/** 視差：遠處的樹走得慢，腳下的草跟老虎同速。 */
export const treeOffset = (x: number): number => Math.floor(x / 2)
export const grassOffset = (x: number): number => x

/** 從圖磚裁出指定寬度的一段；位移越大，畫面越往左移。 */
export const strip = (tile: Sprite, offset: number, width: number): Sprite => {
  const w = spriteWidth(tile)
  return tile.map(row =>
    Array.from({ length: width }, (_, i) => (w === 0 ? '.' : (row[(((i + offset) % w) + w) % w] ?? '.'))).join(''),
  )
}

/** 把 top 疊到 base 的 (x, y)：不透明像素蓋過去，透明的露出 base，超出範圍的裁掉。 */
export const overlay = (base: Sprite, top: Sprite, x: number, y: number): Sprite =>
  base.map((row, r) => {
    const src = top[r - y]
    if (src === undefined) return row
    const out = [...row]
    ;[...src].forEach((px, i) => {
      const c = x + i
      if (px !== '.' && c >= 0 && c < out.length) out[c] = px
    })
    return out.join('')
  })

const evenUp = (n: number): number => n + (n % 2)

/** 草以上的高度：樹與老虎取高的那個，補成偶數列讓半格字元對齊。 */
const bodyHeight = (poseHeight: number, withTrees: boolean): number =>
  Math.max(withTrees ? TREE_HEIGHT : 0, evenUp(poseHeight))

/** 整個場景佔幾行文字：頭頂一行＋樹或老虎＋草一行。 */
export const sceneLines = (poseHeight: number, withTrees: boolean): number =>
  (HEADROOM + bodyHeight(poseHeight, withTrees) + GRASS.length) / 2

/** 面板可見行數放得下清單（含標題）與含樹的場景時才畫樹。 */
export const fitsTrees = (bodyRows: number, listRows: number, poseHeight: number): boolean =>
  listRows + sceneLines(poseHeight, true) <= bodyRows

export type Scene = {
  sprite: Sprite
  /** 老虎最上面一列像素在場景裡的列數。 */
  top: number
}

/** 背景、老虎、草地合成一張圖。老虎與樹都站在草上。 */
export const composeScene = (o: { pose: Sprite; x: number; columns: number; withTrees: boolean }): Scene => {
  const height = HEADROOM + bodyHeight(o.pose.length, o.withTrees)
  const sky: Sprite = Array.from({ length: height }, () => '.'.repeat(o.columns))
  const woods = o.withTrees ? overlay(sky, strip(TREES, treeOffset(o.x), o.columns), 0, height - TREE_HEIGHT) : sky
  const top = height - o.pose.length
  const sprite = [...overlay(woods, o.pose, o.x, top), ...strip(GRASS, grassOffset(o.x), o.columns)]
  return { sprite, top }
}

/** 在第 line 行第 at 欄寫字；底色用該格下半像素的顏色，空白不蓋背景。 */
export const stamp = (cells: readonly (readonly Run[])[], s: Sprite, line: number, at: number, text: string, color: string): Run[][] =>
  cells.map((row, l) => {
    if (l !== line) return [...row]
    const out = [...row]
    ;[...text].forEach((ch, i) => {
      const col = at + i
      if (ch === ' ' || col < 0 || col >= out.length) return
      const bg = PALETTE[s[line * 2 + 1]?.[col] ?? '.']
      out[col] = bg === undefined ? { text: ch, fg: color } : { text: ch, fg: color, bg }
    })
    return out
  })
