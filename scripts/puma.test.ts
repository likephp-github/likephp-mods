import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, describe, test } from 'node:test'

import { decodePng } from './png.ts'
import type { Image } from './png.ts'
import { OUTPUT, PUMA_PALETTE, align, cleanup, convert, dropStrays, gridLines, previewImage, quantize, sourceOf, trim } from './puma.ts'

let img: Image
before(async () => {
  img = decodePng(await readFile(new URL('./assets/green-cloud-and-heart.png', import.meta.url)))
})

describe('量化', () => {
  test('透明度低的像素視為透明', () => {
    assert.equal(quantize(90, 185, 135, 40), '.')
  })
  test('取最接近的顏色', () => {
    assert.deepEqual([quantize(95, 180, 130, 255), quantize(10, 10, 10, 255), quantize(250, 210, 110, 255)], ['C', 'X', 'Y'])
  })
})

describe('格線', () => {
  test('邊界高峰當格線，間距過大處等分補上', () => {
    const edges = new Array<number>(40).fill(0)
    edges[7] = 20
    edges[8] = 12 // 模糊造成的重複邊界，太近會被略過
    edges[22] = 20 // 7 與 22 之間漏了一條，等分補成兩格
    assert.deepEqual(gridLines(edges, 0, 30, 7.5), [0, 7, 14.5, 22, 30])
  })
})

describe('清除雜點', () => {
  test('孤立的單點變透明', () => {
    assert.deepEqual(cleanup(['...', '.C.', '...']), ['...', '...', '...'])
  })
  test('被同色包住的混色單點改成周圍的顏色', () => {
    assert.deepEqual(cleanup(['CCC', 'CYC', 'CCC'])[1], 'CCC')
  })
  test('眼白裡的眼珠與愛心臉上的五官保留', () => {
    assert.deepEqual(cleanup(['III', 'IXI', 'III'])[1], 'IXI')
    assert.deepEqual(cleanup(['RRR', 'RXR', 'RRR'])[1], 'RXR')
    assert.deepEqual(cleanup(['RRR', 'RPR', 'RRR'])[1], 'RPR')
  })
  test('碰到輪廓的腮紅是混色，改回愛心紅', () => {
    assert.deepEqual(cleanup(['XRR', 'XPR', 'XRR'])[1], 'XRR')
  })
  test('只有黑線沒有填色的碎片整塊去掉', () => {
    assert.deepEqual(dropStrays(['X...CC', 'X...CC', 'X...CC']), ['....CC', '....CC', '....CC'])
  })
})

describe('對齊', () => {
  test('去掉四周透明', () => {
    assert.deepEqual(trim(['....', '.CI.', '....']), ['CI'])
  })
  test('眼睛對齊同一欄、腳底對齊最後一列，補成同寬同高', () => {
    const out = align([['CIC', 'YYY'], ['I', 'Y', 'Y']])
    assert.deepEqual(out, [
      ['...', 'CIC', 'YYY'],
      ['.I.', '.Y.', '.Y.'],
    ])
  })
})

describe('轉換原圖', () => {
  test('重跑兩次結果相同', () => {
    assert.equal(sourceOf(convert(img).frames), sourceOf(convert(img).frames))
  })
  test('產生檔是最新的（改了腳本請執行 node scripts/gen-puma.ts）', async () => {
    const committed = await readFile(new URL(`../${OUTPUT}`, import.meta.url), 'utf8')
    assert.equal(committed, sourceOf(convert(img).frames))
  })
  test('推估的原始像素約 7 px', () => {
    const { size } = convert(img)
    assert.ok(size > 6.5 && size < 8, `像素大小 ${size}`)
  })
  test('產生檔註明由哪支腳本產生', () => {
    assert.match(sourceOf([['C']]), /scripts\/gen-puma\.ts/)
  })
})

describe('預覽圖', () => {
  test('每個像素畫成 px 見方的色塊', () => {
    const { width, height, rgba } = previewImage([[['C']]], 2, 6)
    // 四周各留 2 像素的間隔
    assert.deepEqual([width, height], [(1 + 2 + 2) * 2, (1 + 2 + 2) * 2])
    const at = (x: number, y: number) => [...rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)]
    const green = Number.parseInt(PUMA_PALETTE.C!.slice(1), 16)
    assert.deepEqual(at(4, 4), [(green >> 16) & 0xff, (green >> 8) & 0xff, green & 0xff])
    assert.deepEqual(at(0, 0), [0x1e, 0x1e, 0x1e])
  })
})
