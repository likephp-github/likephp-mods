import { describe, expect, test } from 'claude-code/testing'

import { bar, branchFromHead, duration, forecast, limitLabel, loadColor, shortTokens, signedTokens, sparkline } from './forecast'

describe('forecast', () => {
  test('低於 25% 是晴天', async () => {
    expect(forecast(10).icon).toBe('☀')
  })
  test('25% 起是多雲', async () => {
    expect(forecast(25).icon).toBe('☁')
  })
  test('50% 起是陣雨', async () => {
    expect(forecast(50).icon).toBe('☂')
  })
  test('75% 起是暴風雨', async () => {
    expect(forecast(75).icon).toBe('☇')
  })
  test('90% 起提示即將壓縮', async () => {
    expect(forecast(90).icon).toBe('↯')
  })
})

describe('格式化', () => {
  test('sparkline 依百分比由低到高', async () => {
    expect(sparkline([0, 50, 100])).toBe('▁▅█')
  })
  test('token 數縮寫成 k', async () => {
    expect(shortTokens(45_200)).toBe('45.2k')
  })
  test('token 數縮寫成 M', async () => {
    expect(shortTokens(1_000_000)).toBe('1M')
  })
  test('增量帶正負號', async () => {
    expect(signedTokens(-1500)).toBe('-1.5k')
  })
})

describe('HUD 資訊', () => {
  test('用量條依比例填滿', async () => {
    expect(bar(30, 10)).toBe('███░░░░░░░')
  })
  test('時長超過一小時顯示時與分', async () => {
    expect(duration(3 * 3_600_000 + 41 * 60_000)).toBe('3h 41m')
  })
  test('80% 以上顯示紅色', async () => {
    expect(loadColor(85)).toBe('red')
  })
  test('five_hour 縮寫成 5h', async () => {
    expect(limitLabel('five_hour')).toBe('5h')
  })
  test('從 HEAD 讀出分支', async () => {
    expect(branchFromHead('ref: refs/heads/feature/x\n')).toBe('feature/x')
  })
  test('detached HEAD 顯示短 hash', async () => {
    expect(branchFromHead('0123456789abcdef\n')).toBe('0123456')
  })
})
