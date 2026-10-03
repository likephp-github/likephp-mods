/**
 * 最小的 PNG 編解碼器，只用 Node 內建的 zlib，不依賴任何套件。
 * 解碼支援 8-bit 的 RGB／RGBA／灰階（不支援交錯與色盤），一律轉成 RGBA。
 * 編碼只輸出 8-bit RGBA、filter 一律 None，給預覽圖用。
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib'

export type Image = { width: number; height: number; rgba: Uint8Array }

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** 每個 color type 一個像素幾個 channel。 */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** 把每列開頭的 filter type 還原成原始位元組（PNG 規格的五種 filter）。 */
const unfilter = (data: Uint8Array, height: number, stride: number, bpp: number): Uint8Array => {
  const out = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const type = data[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    const prev = row - stride
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[row + i - bpp]! : 0
      const b = y > 0 ? out[prev + i]! : 0
      const c = i >= bpp && y > 0 ? out[prev + i - bpp]! : 0
      const pred = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : type === 4 ? paeth(a, b, c) : NaN
      if (Number.isNaN(pred)) throw new Error(`PNG 第 ${y} 列的 filter type ${type} 不合法`)
      out[row + i] = (data[src + i]! + pred) & 0xff
    }
  }
  return out
}

export const decodePng = (bytes: Uint8Array): Image => {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('不是 PNG 檔（簽章不符）')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let colorType = -1
  const idat: Uint8Array[] = []
  for (let p = 8; p + 8 <= bytes.length; ) {
    const length = view.getUint32(p)
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8))
    const data = bytes.subarray(p + 8, p + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(p + 8)
      height = view.getUint32(p + 12)
      const [depth, color, , , interlace] = data.subarray(8, 13)
      if (depth !== 8 || CHANNELS[color!] === undefined || interlace !== 0)
        throw new Error(`PNG 格式不支援：bit depth ${depth}、color type ${color}、interlace ${interlace}`)
      colorType = color!
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    p += 12 + length
  }
  if (colorType < 0) throw new Error('PNG 缺少 IHDR')
  const channels = CHANNELS[colorType]!
  const raw = unfilter(inflateSync(Buffer.concat(idat)), height, width * channels, channels)
  if (channels === 4) return { width, height, rgba: raw }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = raw.subarray(i * channels, (i + 1) * channels)
    const [r, g, b] = channels >= 3 ? [s[0]!, s[1]!, s[2]!] : [s[0]!, s[0]!, s[0]!]
    const a = channels === 2 ? s[1]! : 255
    rgba.set([r, g, b, a], i * 4)
  }
  return { width, height, rgba }
}

/** 組一個 PNG chunk：長度、型別、資料、CRC。 */
export const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

export const encodePng = (width: number, height: number, rgba: Uint8Array): Uint8Array => {
  const stride = width * 4
  const raw = new Uint8Array(height * (stride + 1))
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return new Uint8Array([
    ...SIGNATURE,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', deflateSync(raw)),
    ...chunk('IEND', new Uint8Array()),
  ])
}
