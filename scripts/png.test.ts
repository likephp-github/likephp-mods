import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'
import { deflateSync } from 'node:zlib'

import { chunk, decodePng, encodePng } from './png.ts'

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** 測試用：照 PNG 規格把每列用指定的 filter 編碼，組成 RGBA 8-bit 的 PNG。 */
const pngWithFilters = (width: number, height: number, rgba: Uint8Array, filters: number[]): Uint8Array => {
  const bpp = 4
  const stride = width * bpp
  const raw: number[] = []
  for (let y = 0; y < height; y++) {
    const type = filters[y % filters.length]!
    raw.push(type)
    for (let i = 0; i < stride; i++) {
      const x = rgba[y * stride + i]!
      const a = i >= bpp ? rgba[y * stride + i - bpp]! : 0
      const b = y > 0 ? rgba[(y - 1) * stride + i]! : 0
      const c = i >= bpp && y > 0 ? rgba[(y - 1) * stride + i - bpp]! : 0
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]!
      raw.push((x - pred) & 0xff)
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return new Uint8Array([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', deflateSync(new Uint8Array(raw))),
    ...chunk('IEND', new Uint8Array()),
  ])
}

const noise = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 73 + ((i * i) % 251)) & 0xff)

describe('PNG 解碼', () => {
  test('五種 filter（None、Sub、Up、Average、Paeth）都能還原', () => {
    const rgba = noise(5 * 4 * 4)
    const img = decodePng(pngWithFilters(5, 4, rgba, [0, 1, 2, 3, 4]))
    assert.deepEqual([img.width, img.height], [5, 4])
    assert.deepEqual(img.rgba, rgba)
  })
  test('自己編的 PNG 解回同樣的像素', () => {
    const rgba = noise(3 * 2 * 4)
    assert.deepEqual(decodePng(encodePng(3, 2, rgba)).rgba, rgba)
  })
  test('不是 PNG 就丟錯', () => {
    assert.throws(() => decodePng(new Uint8Array([1, 2, 3])), /PNG/)
  })
  test('讀得出原圖的尺寸', async () => {
    const img = decodePng(await readFile(new URL('./assets/green-cloud-and-heart.png', import.meta.url)))
    assert.deepEqual([img.width, img.height, img.rgba.length], [2172, 724, 2172 * 724 * 4])
  })
})
