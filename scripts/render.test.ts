import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'

import { BACKGROUND, GLYPHS, SCALE, clips, loadMod, paletteOf, rasterize } from './render.ts'
import type { Mod } from './render.ts'

let mod: Mod
before(async () => {
  mod = await loadMod()
})

const frameOf = (sprite: string[], marks: { line: number; col: number; text: string; color: string }[] = []) => ({
  sprite,
  marks,
  x: 0,
  tigerLine: 0,
  room: 0,
  stride: 1,
})

describe('柵格化', () => {
  test('每個像素展開成 8×8 色塊', () => {
    const palette = paletteOf(mod)
    const { width, height, indices } = rasterize(frameOf(['O.']), mod.PALETTE, palette)
    const orange = palette.indexOf(mod.PALETTE.O!)
    const bg = palette.indexOf(BACKGROUND)
    assert.deepEqual([width, height], [2 * SCALE, SCALE])
    assert.equal(indices.slice(0, SCALE).every(i => i === orange), true)
    assert.equal(indices.slice(SCALE, 2 * SCALE).every(i => i === bg), true)
    assert.equal(indices.filter(i => i === orange).length, SCALE * SCALE)
  })
  test('符號那一格先填下半像素的顏色，再畫點陣', () => {
    const palette = paletteOf(mod)
    const { indices, width } = rasterize(frameOf(['G', 'B'], [{ line: 0, col: 0, text: 'z', color: 'cyan' }]), mod.PALETTE, palette)
    const brown = palette.indexOf(mod.PALETTE.B!)
    const cyan = palette.indexOf('#56b6c2')
    assert.equal(indices[0], brown)
    const dots = GLYPHS.z!.join('').split('').filter(c => c === '#').length
    assert.equal(indices.filter(i => i === cyan).length, dots * (SCALE / 4) ** 2)
    assert.equal(width, SCALE)
  })
  test('空白不蓋背景', () => {
    const palette = paletteOf(mod)
    const plain = rasterize(frameOf(['G', 'G']), mod.PALETTE, palette).indices
    assert.deepEqual(rasterize(frameOf(['G', 'G'], [{ line: 0, col: 0, text: ' ', color: 'cyan' }]), mod.PALETTE, palette).indices, plain)
  })
  test('超出畫面的符號被裁掉', () => {
    const palette = paletteOf(mod)
    const plain = rasterize(frameOf(['.', '.']), mod.PALETTE, palette).indices
    assert.deepEqual(rasterize(frameOf(['.', '.'], [{ line: 0, col: 1, text: 'z', color: 'cyan' }]), mod.PALETTE, palette).indices, plain)
  })
  test('每個符號的點陣都是 4×8', () => {
    assert.equal(Object.values(GLYPHS).every(g => g.length === 8 && g.every(r => r.length === 4)), true)
  })
})

describe('三段動畫', () => {
  test('寬 320px，同一段每格高度一致', () => {
    for (const clip of clips(mod)) {
      const sizes = new Set(clip.frames.map(f => `${f.sprite[0]?.length}x${f.sprite.length}`))
      assert.equal(sizes.size, 1, clip.name)
      assert.equal((clip.frames[0]?.sprite[0]?.length ?? 0) * SCALE, 320)
    }
  })
  test('格數：巡邏 46、抓蝴蝶 8、睡覺 48', () => {
    assert.deepEqual(Object.fromEntries(clips(mod).map(c => [c.name, c.frames.length])), { walk: 46, play: 8, sleep: 48 })
  })
  test('最後一格的下一格就是第一格（無縫循環）', () => {
    for (const clip of clips(mod)) assert.deepEqual(clip.after, clip.frames[0], clip.name)
  })
  test('場景用到的像素都在色盤裡', () => {
    const palette = paletteOf(mod)
    for (const clip of clips(mod)) {
      const { indices } = rasterize(clip.frames[0]!, mod.PALETTE, palette)
      assert.equal(indices.every(i => i >= 0), true, clip.name)
    }
  })
  test('巡邏時背景會捲動', () => {
    const walk = clips(mod).find(c => c.name === 'walk')!
    const grass = (i: number) => walk.frames[i]!.sprite.at(-1)
    assert.notEqual(grass(0), grass(5))
  })
})
