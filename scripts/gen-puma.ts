/**
 * 重新產生綠雲與愛心（puma 主題）的走路圖：node scripts/gen-puma.ts
 * 讀 scripts/assets/green-cloud-and-heart.png，寫出 session-radar/hooks/puma-sprites.ts，
 * 並輸出預覽圖 docs/images/puma-preview.png（1 倍、0.7 倍與三色丸子）。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { DANGO } from '../session-radar/hooks/dango.ts'
import { decodePng, encodePng } from './png.ts'
import { OUTPUT, convert, previewImage, sourceOf } from './puma.ts'
import { allowExtensionlessImports } from './render.ts'

allowExtensionlessImports()
// sprite.ts 以不帶副檔名的方式 import text，要等 hook 註冊後才能載入
const { sized } = await import('../session-radar/hooks/sprite.ts')

/** 預覽圖每個像素幾 px 見方。 */
const PREVIEW_PX = 4
/** 預覽的縮小倍數（puma 在面板上的最小體型）。 */
const SMALL = 0.7

const root = (path: string) => fileURLToPath(import.meta.resolve(`../${path}`))

const img = decodePng(await readFile(root('scripts/assets/green-cloud-and-heart.png')))
const { frames, size } = convert(img)
await writeFile(root(OUTPUT), sourceOf(frames))
const w = frames[0]?.[0]?.length ?? 0
console.log(`${OUTPUT}  ${frames.length} 格  ${w}×${frames[0]?.length ?? 0}（原圖像素格約 ${size.toFixed(2)} px）`)

const preview = previewImage([frames, frames.map(f => sized(f, SMALL)), DANGO], PREVIEW_PX, 6)
await writeFile(root('docs/images/puma-preview.png'), encodePng(preview.width, preview.height, preview.rgba))
console.log(`docs/images/puma-preview.png  ${preview.width}×${preview.height}`)
