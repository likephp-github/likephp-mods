/**
 * 重新產生 README 的動作圖：node scripts/gen-gifs.ts
 * 登錄表中每個主題 × 每個狀態一張，寫到 docs/images/<主題>-<狀態>.gif；
 * 每一格都由 session-radar 面板同一套動畫邏輯算出。
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { encodeGif } from './gif.ts'
import { clips, loadMod, paletteOf, rasterize } from './render.ts'

/** 每格時間，與 mod 的動畫間隔相同。 */
const FRAME_MS = 400

const mod = await loadMod()

for (const clip of clips(mod)) {
  const theme = mod.themes[clip.theme]!
  const palette = paletteOf(theme, clip.frames)
  const rasters = clip.frames.map(f => rasterize(f, theme.palette, palette))
  const { width, height } = rasters[0]!
  const gif = encodeGif({ width, height, palette, frames: rasters.map(r => ({ indices: r.indices, delayMs: FRAME_MS })) })
  const file = `docs/images/${clip.name}.gif`
  await writeFile(fileURLToPath(new URL(`../${file}`, import.meta.url)), gif)
  console.log(`${file}  ${width}×${height}  ${clip.frames.length} 格  ${gif.length} bytes`)
}
