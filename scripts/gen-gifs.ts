/**
 * 重新產生 README 的老虎動作圖：node scripts/gen-gifs.ts
 * 每一格都由 session-radar 面板同一套動畫邏輯算出，寫到 docs/images/tiger-*.gif。
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { encodeGif } from './gif.ts'
import { clips, loadMod, paletteOf, rasterize } from './render.ts'

/** 每格時間，與 mod 的動畫間隔相同。 */
const FRAME_MS = 400

const mod = await loadMod()
const palette = paletteOf(mod)

for (const clip of clips(mod)) {
  const rasters = clip.frames.map(f => rasterize(f, mod.PALETTE, palette))
  const { width, height } = rasters[0]!
  const gif = encodeGif({ width, height, palette, frames: rasters.map(r => ({ indices: r.indices, delayMs: FRAME_MS })) })
  const path = fileURLToPath(import.meta.resolve(`../docs/images/tiger-${clip.name}.gif`))
  await writeFile(path, gif)
  console.log(`docs/images/tiger-${clip.name}.gif  ${width}×${height}  ${clip.frames.length} 格  ${gif.length} bytes`)
}
