import { describe, expect, test } from 'claude-code/testing'

import { GRASS, TREES, TREE_HEIGHT, composeScene, fitsTrees, grassOffset, overlay, sceneLines, strip, treeOffset } from './scene'
import { sized, spriteWidth, stamp, toCells } from './sprite'
import { PALETTE, SLEEP, WALK } from './tiger'

const isTree = (px: string) => px === 'G' || px === 'L' || px === 'B'

describe('背景圖磚', () => {
  test('每列寬度一致', async () => {
    expect([TREES, GRASS].every(tile => tile.every(row => row.length === spriteWidth(tile)))).toBe(true)
  })
  test('樹高 8 像素', async () => {
    expect(TREE_HEIGHT).toBe(8)
  })
  test('背景用到的像素都有顏色', async () => {
    expect([...TREES, ...GRASS].join('').replaceAll('.', '').split('').every(px => PALETTE[px] !== undefined)).toBe(true)
  })
})

describe('捲動', () => {
  test('輸出寬度等於指定寬度', async () => {
    expect(strip(TREES, 5, 40).every(row => row.length === 40)).toBe(true)
  })
  test('位移一整塊圖磚等於沒有位移', async () => {
    expect(strip(TREES, spriteWidth(TREES), 30)).toEqual(strip(TREES, 0, 30))
  })
  test('負位移會正確循環', async () => {
    expect(strip(TREES, -1, 30)).toEqual(strip(TREES, spriteWidth(TREES) - 1, 30))
  })
  test('位移越大畫面往左移', async () => {
    expect(strip(['abc'], 1, 3)).toEqual(['bca'])
  })
  test('樹的捲動速度是老虎的一半', async () => {
    expect([treeOffset(0), treeOffset(1), treeOffset(7)]).toEqual([0, 0, 3])
  })
  test('草跟老虎同速', async () => {
    expect(grassOffset(7)).toBe(7)
  })
})

describe('合成', () => {
  test('不透明像素蓋過背景', async () => {
    expect(overlay(['GGG'], ['O'], 1, 0)).toEqual(['GOG'])
  })
  test('透明像素露出背景', async () => {
    expect(overlay(['GGG'], ['O.O'], 0, 0)).toEqual(['OGO'])
  })
  test('超出背景的部分被裁掉', async () => {
    expect(overlay(['...', '...'], ['OO', 'OO'], 2, 1)).toEqual(['...', '..O'])
  })
})

describe('場景', () => {
  const small = sized(WALK[0] ?? [], 0.5)
  const big = sized(WALK[0] ?? [], 1.5)
  const treeRows = (s: readonly string[]) => s.filter(row => [...row].some(isTree)).length

  test('老虎 0.5 倍與 1.5 倍時樹一樣高', async () => {
    const a = composeScene({ pose: small, x: 0, columns: 40, withTrees: true }).sprite
    const b = composeScene({ pose: big, x: 0, columns: 40, withTrees: true }).sprite
    expect([treeRows(a), treeRows(b)]).toEqual([TREE_HEIGHT, TREE_HEIGHT])
  })
  test('最後兩列是草，老虎的腳在草上一列', async () => {
    for (const pose of [small, big, sized(SLEEP, 1)]) {
      const { sprite } = composeScene({ pose, x: 3, columns: 40, withTrees: true })
      const feet = [...(sprite[sprite.length - 3] ?? '')]
      const paws = [...(pose[pose.length - 1] ?? '')]
      expect(sprite.slice(-2)).toEqual(strip(GRASS, grassOffset(3), 40))
      expect(paws.every((px, i) => px === '.' || feet[3 + i] === px)).toBe(true)
    }
  })
  test('不畫樹時只有草', async () => {
    const { sprite } = composeScene({ pose: small, x: 0, columns: 40, withTrees: false })
    expect(treeRows(sprite.slice(0, -2))).toBe(0)
  })
  test('x 不變時背景不變', async () => {
    const a = composeScene({ pose: WALK[0] ?? [], x: 4, columns: 40, withTrees: true })
    const b = composeScene({ pose: WALK[1] ?? [], x: 4, columns: 40, withTrees: true })
    expect(a.sprite.map(r => r.slice(30))).toEqual(b.sprite.map(r => r.slice(30)))
  })
  test('高度是偶數列，頭頂永遠留一行', async () => {
    const { sprite, top } = composeScene({ pose: small, x: 0, columns: 40, withTrees: false })
    expect([sprite.length % 2, Math.floor(top / 2) >= 1]).toEqual([0, true])
  })
  test('場景行數與合成結果一致', async () => {
    for (const withTrees of [true, false]) {
      const { sprite } = composeScene({ pose: big, x: 0, columns: 40, withTrees })
      expect(sceneLines(big.length, withTrees)).toBe(sprite.length / 2)
    }
  })
})

describe('矮面板', () => {
  test('放得下清單與含樹的場景時畫樹', async () => {
    expect(fitsTrees(3 + sceneLines(5, true), 3, 5)).toBe(true)
  })
  test('放不下時只畫草', async () => {
    expect(fitsTrees(2 + sceneLines(5, true), 3, 5)).toBe(false)
  })
})

describe('文字符號', () => {
  test('底色是該格下半像素的背景色', async () => {
    const s = ['G.', 'B.']
    const [line] = stamp(toCells(s, PALETTE), s, 0, 0, 'z', 'cyan', PALETTE)
    expect(line?.[0]).toEqual({ text: 'z', fg: 'cyan', bg: PALETTE.B })
  })
  test('下半像素透明就不設底色', async () => {
    const s = ['..', '..']
    expect(stamp(toCells(s, PALETTE), s, 0, 1, 'z', 'cyan', PALETTE)[0]?.[1]).toEqual({ text: 'z', fg: 'cyan' })
  })
  test('空白不蓋掉背景', async () => {
    const s = ['GGG', 'GGG']
    expect(stamp(toCells(s, PALETTE), s, 0, 0, 'z Z', 'cyan', PALETTE)[0]?.[1]).toEqual(toCells(s, PALETTE)[0]?.[1])
  })
  test('超出畫面的字被裁掉', async () => {
    const s = ['..', '..']
    expect(stamp(toCells(s, PALETTE), s, 0, 1, 'ʚɞ', 'magenta', PALETTE)[0]?.length).toBe(2)
  })
})
