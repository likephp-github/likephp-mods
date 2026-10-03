import { describe, expect, test } from 'claude-code/testing'

import { NAP_AFTER_MS, PLAY, PLAY_STEPS, SLEEP, SLEEP_CYCLE, sleepPose, WALK, factorFor, flight, modeFor, mirror, resize, scale, sized, snore, spriteWidth, step, toRuns } from './tiger'

describe('像素圖', () => {
  test('每個姿勢每列寬度一致', async () => {
    const all = [...WALK, ...PLAY, ...PLAY_STEPS, SLEEP]
    expect(all.every(s => s.every(row => row.length === spriteWidth(SLEEP)))).toBe(true)
  })
  test('放大兩倍寬高都加倍', async () => {
    const big = scale(SLEEP, 2)
    expect([big.length, spriteWidth(big)]).toEqual([SLEEP.length * 2, spriteWidth(SLEEP) * 2])
  })
  test('左右翻轉', async () => {
    expect(mirror(['OK.'])).toEqual(['.KO'])
  })
  test('兩列像素合成一列半格字元', async () => {
    expect(toRuns(SLEEP).length).toBe(SLEEP.length / 2)
  })
  test('上方透明下方有色用 ▄', async () => {
    expect(toRuns(['.', 'O'])[0]?.[0]?.text).toBe('▄')
  })
})

describe('體型', () => {
  test('上下文 100% 時是面板容得下的最大整數倍', async () => {
    expect(factorFor(100, 40, 18)).toBe(2)
  })
  test('最大不超過 3 倍', async () => {
    expect(factorFor(100, 200, 18)).toBe(3)
  })
  test('50% 是滿版的一半', async () => {
    expect(factorFor(50, 40, 18)).toBe(1)
  })
  test('用量很低時不小於 1 倍', async () => {
    expect(factorFor(5, 40, 18)).toBe(1)
  })
  test('還沒有用量時是最小值', async () => {
    expect(factorFor(undefined, 40, 18)).toBe(1)
  })
  test('滿版 3 倍時 50% 是 1.5 倍', async () => {
    expect(factorFor(50, 60, 18)).toBe(1.5)
  })
  test('縮成一半寬高都減半', async () => {
    const small = sized(WALK[0] ?? [], 0.5)
    expect([spriteWidth(small), small.length]).toEqual([9, 5])
  })
  test('縮放到原尺寸不變', async () => {
    expect(resize(SLEEP, spriteWidth(SLEEP), SLEEP.length)).toEqual(SLEEP)
  })
})

describe('動作', () => {
  test('往右走一步', async () => {
    expect(step({ x: 2, facing: 1 }, 10, 1)).toEqual({ x: 3, facing: 1 })
  })
  test('碰到右邊界轉身', async () => {
    expect(step({ x: 10, facing: 1 }, 10, 1)).toEqual({ x: 10, facing: -1 })
  })
  test('碰到左邊界轉身', async () => {
    expect(step({ x: 0, facing: -1 }, 10, 2)).toEqual({ x: 0, facing: 1 })
  })
  test('打呼節奏會循環', async () => {
    expect(snore(0)).toBe(snore(16))
  })
})

describe('閒置', () => {
  test('工作中會走路', async () => {
    expect(modeFor(true, 0, 1000)).toBe('walk')
  })
  test('剛閒置時抓蝴蝶', async () => {
    expect(modeFor(false, 1000, 1000 + 5_000)).toBe('play')
  })
  test('閒置滿 30 秒就睡覺', async () => {
    expect(modeFor(false, 1000, 1000 + NAP_AFTER_MS)).toBe('sleep')
  })
  test('從沒工作過直接睡', async () => {
    expect(modeFor(false, 0, 5_000)).toBe('sleep')
  })
  test('蝴蝶從頭頂出發', async () => {
    expect(flight(0, 2).row).toBe(-1)
  })
  test('飛到前掌那一行時被拍到', async () => {
    const hit = Array.from({ length: 8 }, (_, f) => flight(f, 2)).find(f => f.isHit)
    expect([hit?.row, hit?.col]).toEqual([2, 0])
  })
  test('被拍到時變成星星', async () => {
    expect(flight(4, 2).glyph).toBe('*')
  })
  test('抓蝴蝶的姿勢與蝴蝶飛行步數一致', async () => {
    expect(PLAY_STEPS.length).toBe(8)
  })
  test('被拍到的那一步老虎跳起來', async () => {
    const hitStep = Array.from({ length: 8 }, (_, f) => f).find(f => flight(f, 2).isHit) ?? 0
    expect(PLAY_STEPS[hitStep]?.[9]).toBe('..................')
  })
  test('一輪飛完會循環', async () => {
    expect(flight(3, 2)).toEqual(flight(11, 2))
  })
  test('老虎很小時不會飛到頭頂之上', async () => {
    expect(flight(2, 0).row).toBe(-1)
  })
})

describe('睡覺', () => {
  test('每一格睡姿尺寸不變', async () => {
    const poses = Array.from({ length: SLEEP_CYCLE }, (_, f) => sleepPose(f))
    expect(poses.every(p => p.length === SLEEP.length && p.every(r => r.length === spriteWidth(SLEEP)))).toBe(true)
  })
  test('呼吸時背部會起伏', async () => {
    expect(sleepPose(0)).not.toEqual(sleepPose(3))
  })
  test('尾巴會抖', async () => {
    expect(sleepPose(8)[3]).not.toBe(sleepPose(7)[3])
  })
  test('耳朵會抖', async () => {
    expect(sleepPose(13)[0]).not.toBe(sleepPose(12)[0])
  })
})

