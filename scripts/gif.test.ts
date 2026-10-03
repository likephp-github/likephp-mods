import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { encodeGif, lzwEncode } from './gif.ts'

/** 測試用的 LZW 解碼器：照 GIF 規格把 code 串解回色彩索引。 */
const lzwDecode = (minCodeSize: number, data: Uint8Array): number[] => {
  const clear = 1 << minCodeSize
  const end = clear + 1
  let size = minCodeSize + 1
  let dict: number[][] = []
  const reset = () => {
    dict = Array.from({ length: clear }, (_, i) => [i])
    dict.push([], [])
    size = minCodeSize + 1
  }
  reset()
  const out: number[] = []
  let prev: number[] | undefined
  let bit = 0
  const read = () => {
    let code = 0
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3]! >> (bit & 7)) & 1) << i
    return code
  }
  while (bit + size <= data.length * 8) {
    const code = read()
    if (code === clear) {
      reset()
      prev = undefined
      continue
    }
    if (code === end) break
    const entry = code < dict.length ? dict[code]! : [...prev!, prev![0]!]
    out.push(...entry)
    if (prev !== undefined && dict.length < 4096) dict.push([...prev, entry[0]!])
    if (dict.length === 1 << size && size < 12) size++
    prev = entry
  }
  return out
}

/** 拆出 GIF 的每一張影像：寬高、LZW 資料與延遲。 */
const parseGif = (bytes: Uint8Array) => {
  const header = new TextDecoder().decode(bytes.slice(0, 6))
  const width = bytes[6]! | (bytes[7]! << 8)
  const height = bytes[8]! | (bytes[9]! << 8)
  const packed = bytes[10]!
  let p = 13 + (packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0)
  const frames: { pixels: number[]; delay: number }[] = []
  let loops = false
  let delay = 0
  const subBlocks = () => {
    const chunks: number[] = []
    while (bytes[p] !== 0) {
      const n = bytes[p]!
      chunks.push(...bytes.slice(p + 1, p + 1 + n))
      p += n + 1
    }
    p++
    return new Uint8Array(chunks)
  }
  while (p < bytes.length) {
    const b = bytes[p++]
    if (b === 0x3b) break
    if (b === 0x21) {
      const label = bytes[p++]
      if (label === 0xf9) delay = bytes[p + 2]! | (bytes[p + 3]! << 8)
      const body = subBlocks()
      if (label === 0xff && new TextDecoder().decode(body.slice(0, 11)) === 'NETSCAPE2.0') loops = true
      continue
    }
    if (b === 0x2c) {
      p += 9
      const min = bytes[p++]!
      frames.push({ pixels: lzwDecode(min, subBlocks()), delay })
    }
  }
  return { header, width, height, frames, loops }
}

const PALETTE = ['#000000', '#ff0000', '#00ff00', '#0000ff']

describe('GIF 編碼', () => {
  test('開頭是 GIF89a、寬高正確', () => {
    const gif = parseGif(encodeGif({ width: 3, height: 2, palette: PALETTE, frames: [{ indices: [0, 1, 2, 3, 2, 1], delayMs: 400 }] }))
    assert.deepEqual([gif.header, gif.width, gif.height], ['GIF89a', 3, 2])
  })
  test('有無限循環設定', () => {
    assert.equal(parseGif(encodeGif({ width: 1, height: 1, palette: PALETTE, frames: [{ indices: [0], delayMs: 400 }] })).loops, true)
  })
  test('每格延遲以百分之一秒記錄', () => {
    const gif = parseGif(encodeGif({ width: 1, height: 1, palette: PALETTE, frames: [{ indices: [0], delayMs: 400 }] }))
    assert.equal(gif.frames[0]?.delay, 40)
  })
  test('格數正確，每格解回原圖', () => {
    const a = [0, 1, 2, 3, 3, 3, 3, 0, 1]
    const b = [3, 3, 3, 3, 3, 3, 3, 3, 3]
    const gif = parseGif(encodeGif({ width: 3, height: 3, palette: PALETTE, frames: [{ indices: a, delayMs: 400 }, { indices: b, delayMs: 400 }] }))
    assert.deepEqual(gif.frames.map(f => f.pixels), [a, b])
  })
  test('色盤補到 2 的次方', () => {
    const palette = ['#000000', '#111111', '#222222']
    const gif = parseGif(encodeGif({ width: 2, height: 1, palette, frames: [{ indices: [2, 1], delayMs: 400 }] }))
    assert.deepEqual(gif.frames[0]?.pixels, [2, 1])
  })
})

describe('LZW', () => {
  test('大圖超過 4096 個 code 會重置字典，仍能解回原圖', () => {
    const pixels = Array.from({ length: 40_000 }, (_, i) => (i * 7 + (i >> 5)) % 16)
    assert.deepEqual(lzwDecode(4, lzwEncode(4, pixels)), pixels)
  })
  test('全部同色也能解回', () => {
    const pixels = Array.from({ length: 5000 }, () => 1)
    assert.deepEqual(lzwDecode(2, lzwEncode(2, pixels)), pixels)
  })
})
