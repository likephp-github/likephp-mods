/** 最小的 GIF89a 編碼器：全域色盤、無限循環、每格固定延遲，不依賴任何套件。 */

export type GifFrame = { indices: readonly number[]; delayMs: number }
export type GifSpec = { width: number; height: number; palette: readonly string[]; frames: readonly GifFrame[] }

/** 把色彩索引以 GIF 的 LZW（可變長度 code、LSB 先）壓縮。 */
export const lzwEncode = (minCodeSize: number, indices: readonly number[]): Uint8Array => {
  const clear = 1 << minCodeSize
  const end = clear + 1
  const out: number[] = []
  let acc = 0
  let accBits = 0
  let size = minCodeSize + 1
  let next = end + 1
  let dict = new Map<number, number>()
  const write = (code: number) => {
    acc |= code << accBits
    accBits += size
    while (accBits >= 8) {
      out.push(acc & 0xff)
      acc >>>= 8
      accBits -= 8
    }
  }
  const reset = () => {
    dict = new Map()
    size = minCodeSize + 1
    next = end + 1
  }

  write(clear)
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const px = indices[i] ?? 0
    const key = ((prefix ?? 0) << 8) | px
    const known = dict.get(key)
    if (known !== undefined) {
      prefix = known
      continue
    }
    write(prefix ?? 0)
    if (next < 4096) {
      dict.set(key, next++)
      if (next > 1 << size && size < 12) size++
    } else {
      // 字典滿了：送出 clear，從頭建字典
      write(clear)
      reset()
    }
    prefix = px
  }
  if (prefix !== undefined) write(prefix)
  write(end)
  if (accBits > 0) out.push(acc & 0xff)
  return new Uint8Array(out)
}

const hexToRgb = (hex: string): number[] => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff]

/** 資料切成每塊最多 255 bytes 的 sub-block，最後補 0 結尾。 */
const subBlocks = (data: Uint8Array): number[] => {
  const out: number[] = []
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.subarray(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0)
  return out
}

export const encodeGif = (spec: GifSpec): Uint8Array => {
  // 色盤大小必須是 2 的次方（至少 2 色）
  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, spec.palette.length))))
  const colors = Array.from({ length: 1 << bits }, (_, i) => hexToRgb(spec.palette[i] ?? '#000000')).flat()
  const minCodeSize = Math.max(2, bits)

  const bytes: number[] = [
    ...new TextEncoder().encode('GIF89a'),
    ...u16(spec.width),
    ...u16(spec.height),
    0x80 | ((bits - 1) << 4) | (bits - 1),
    0,
    0,
    ...colors,
    // NETSCAPE2.0：無限循環
    0x21, 0xff, 0x0b, ...new TextEncoder().encode('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00,
  ]
  for (const frame of spec.frames) {
    bytes.push(0x21, 0xf9, 0x04, 0x04, ...u16(Math.round(frame.delayMs / 10)), 0x00, 0x00)
    bytes.push(0x2c, 0, 0, 0, 0, ...u16(spec.width), ...u16(spec.height), 0x00)
    bytes.push(minCodeSize, ...subBlocks(lzwEncode(minCodeSize, frame.indices)))
  }
  bytes.push(0x3b)
  return new Uint8Array(bytes)
}
