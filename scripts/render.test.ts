import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'

import { BACKGROUND, CLIP_PLANS, GLYPHS, SCALE, clips, gifMarks, loadMod, paletteOf, rasterize } from './render.ts'
import type { Clip, Mod } from './render.ts'

let mod: Mod
let all: Clip[]
before(async () => {
  mod = await loadMod()
  all = clips(mod)
})

const tiger = () => mod.themes.tiger!
const frameOf = (sprite: string[], marks: { line: number; col: number; text: string; color: string }[] = []) => ({
  sprite,
  marks,
  x: 0,
  tigerLine: 0,
  room: 0,
  stride: 1,
})
const clipOf = (name: string) => all.find(c => c.name === name)!
/** 這段動畫實際會畫出來的所有文字。 */
const drawnText = (clip: Clip) => clip.frames.flatMap(f => gifMarks(f.marks).map(m => m.text)).join('')

describe('柵格化', () => {
  test('每個像素展開成 8×8 色塊', () => {
    const palette = paletteOf(tiger(), [])
    const { width, height, indices } = rasterize(frameOf(['O.']), tiger().palette, palette)
    const orange = palette.indexOf(tiger().palette.O!)
    const bg = palette.indexOf(BACKGROUND)
    assert.deepEqual([width, height], [2 * SCALE, SCALE])
    assert.equal(indices.slice(0, SCALE).every(i => i === orange), true)
    assert.equal(indices.slice(SCALE, 2 * SCALE).every(i => i === bg), true)
    assert.equal(indices.filter(i => i === orange).length, SCALE * SCALE)
  })
  test('符號那一格先填下半像素的顏色，再畫點陣', () => {
    const palette = paletteOf(tiger(), [])
    const { indices, width } = rasterize(frameOf(['G', 'B'], [{ line: 0, col: 0, text: 'z', color: 'cyan' }]), tiger().palette, palette)
    const brown = palette.indexOf(tiger().palette.B!)
    const cyan = palette.indexOf('#56b6c2')
    assert.equal(indices[0], brown)
    const dots = GLYPHS.z!.join('').split('').filter(c => c === '#').length
    assert.equal(indices.filter(i => i === cyan).length, dots * (SCALE / 4) ** 2)
    assert.equal(width, SCALE)
  })
  test('空白不蓋背景', () => {
    const palette = paletteOf(tiger(), [])
    const plain = rasterize(frameOf(['G', 'G']), tiger().palette, palette).indices
    assert.deepEqual(rasterize(frameOf(['G', 'G'], [{ line: 0, col: 0, text: ' ', color: 'cyan' }]), tiger().palette, palette).indices, plain)
  })
  test('超出畫面的符號被裁掉', () => {
    const palette = paletteOf(tiger(), [])
    const plain = rasterize(frameOf(['.', '.']), tiger().palette, palette).indices
    assert.deepEqual(rasterize(frameOf(['.', '.'], [{ line: 0, col: 1, text: 'z', color: 'cyan' }]), tiger().palette, palette).indices, plain)
  })
  test('色盤裡沒有的符號顏色直接報錯，不會悄悄畫成別的顏色', () => {
    const palette = paletteOf(tiger(), [])
    assert.throws(() => rasterize(frameOf(['.', '.'], [{ line: 0, col: 0, text: 'z', color: 'nope' }]), tiger().palette, palette))
  })
})

describe('點陣字', () => {
  test('每個符號的點陣都是 4×8', () => {
    assert.equal(Object.values(GLYPHS).every(g => g.length === 8 && g.every(r => r.length === 4)), true)
  })
  test('有綠雲與愛心主題用到的 ♥、星星、nom 與 …', () => {
    assert.deepEqual(['♥', '✦', '✧', '·', 'n', 'o', 'm', '…'].filter(ch => GLYPHS[ch] === undefined), [])
  })
  test('每個點陣至少有一點、且彼此不同', () => {
    const shapes = Object.values(GLYPHS).map(g => g.join(''))
    assert.equal(shapes.every(s => s.includes('#')), true)
    assert.equal(new Set(shapes).size, shapes.length)
  })
  test('所有動畫實際會畫的字元都有點陣', () => {
    const missing = new Set([...all.map(drawnText).join('')].filter(ch => ch !== ' ' && GLYPHS[ch] === undefined))
    assert.deepEqual([...missing], [])
  })
})

describe('中文名言不畫', () => {
  const heart = { line: 3, col: 10, text: '♥', color: 'redBright' }
  test('含中文的行收成一個 …，放在最下面那行名言的中間', () => {
    const quote = [
      { line: 1, col: 4, text: '「我本來就不是', color: 'white' },
      { line: 2, col: 6, text: '以外表取勝。」', color: 'white' },
    ]
    assert.deepEqual(gifMarks([...quote, heart]), [heart, { line: 2, col: 13, text: '…', color: 'white' }])
  })
  test('沒有中文時原樣保留', () => {
    const marks = [heart, { line: 0, col: 0, text: '✦', color: 'yellowBright' }]
    assert.deepEqual(gifMarks(marks), marks)
  })
})

describe('每個主題 × 每個狀態一段動畫', () => {
  test('tiger、puma 各三個狀態，共 6 段', () => {
    assert.deepEqual(
      all.map(c => c.name),
      ['tiger-working', 'tiger-resting', 'tiger-idle', 'puma-working', 'puma-resting', 'puma-idle'],
    )
  })
  test('同一段每格大小一致；tiger 寬 320px', () => {
    for (const clip of all) {
      const sizes = new Set(clip.frames.map(f => `${f.sprite[0]?.length}x${f.sprite.length}`))
      assert.equal(sizes.size, 1, clip.name)
      assert.equal((clip.frames[0]?.sprite[0]?.length ?? 0) * SCALE, CLIP_PLANS[clip.theme]!.columns * SCALE, clip.name)
    }
    assert.equal(CLIP_PLANS.tiger!.columns * SCALE, 320)
  })
  test('tiger 格數不變：working 46、resting 8、idle 48', () => {
    assert.deepEqual(
      Object.fromEntries(all.filter(c => c.theme === 'tiger').map(c => [c.state, c.frames.length])),
      { working: 46, resting: 8, idle: 48 },
    )
  })
  test('最後一格的下一格就是第一格（無縫循環）', () => {
    for (const clip of all) assert.deepEqual(clip.after, clip.frames[0], clip.name)
  })
  test('tiger 的色盤與改名前相同', () => {
    const t = tiger()
    assert.deepEqual(paletteOf(t, all.filter(c => c.theme === 'tiger').flatMap(c => c.frames)), [
      BACKGROUND,
      ...new Set(Object.values(t.palette)),
      '#56b6c2',
      '#e5c07b',
      '#c678dd',
    ])
  })
  test('每段每格用到的像素與符號顏色都在色盤裡', () => {
    for (const clip of all) {
      const theme = mod.themes[clip.theme]!
      const palette = paletteOf(theme, clip.frames)
      for (const f of clip.frames) assert.equal(rasterize(f, theme.palette, palette).indices.every(i => i >= 0), true, clip.name)
    }
  })
  test('tiger 巡邏時背景會捲動', () => {
    const walk = clipOf('tiger-working')
    const grass = (i: number) => walk.frames[i]!.sprite.at(-1)
    assert.notEqual(grass(0), grass(5))
  })
})

describe('puma 動畫裡看得到的東西', () => {
  // 實測低於 0.91 倍時，多數格只有 1 像素的黑眼珠會被取樣掉，臉看不清楚
  test('倍數至少是看得清楚臉的 0.91', () => {
    assert.equal(CLIP_PLANS.puma!.factor >= 0.91, true)
  })
  test('面板放得下角色：每一格都畫出了角色', () => {
    for (const state of ['working', 'resting', 'idle']) {
      assert.equal(clipOf(`puma-${state}`).frames.every(f => f.sprite.some(row => row.includes('C'))), true, state)
    }
  })
  test('resting：頭頂有 ♥ 與 …，名言不畫中文', () => {
    const text = drawnText(clipOf('puma-resting'))
    assert.equal(text.includes('♥') && text.includes('…'), true)
  })
  test('每段都有星星，而且有 ✦ 與 ✧', () => {
    for (const state of ['working', 'resting', 'idle']) assert.match(drawnText(clipOf(`puma-${state}`)), /·/, state)
    const text = all.filter(c => c.theme === 'puma').map(drawnText).join('')
    assert.equal(text.includes('✦') && text.includes('✧'), true)
  })
  test('idle：手上有丸子（比站姿多出粉紅色像素），而且有 nom', () => {
    const idle = clipOf('puma-idle')
    const pink = (sprite: readonly string[]) => sprite.join('').split('P').length - 1
    const stand = pink(clipOf('puma-resting').frames[0]!.sprite)
    assert.equal(pink(idle.frames[0]!.sprite) > stand, true)
    assert.match(drawnText(idle), /nom/)
  })
})
