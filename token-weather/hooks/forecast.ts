export type Weather = { icon: string; label: string; color: string }

const BARS = '▁▂▃▄▅▆▇█'

export const forecast = (percent: number): Weather => {
  if (percent >= 90) return { icon: '↯', label: '即將壓縮', color: 'red' }
  if (percent >= 75) return { icon: '☇', label: '暴風雨', color: 'magenta' }
  if (percent >= 50) return { icon: '☂', label: '陣雨', color: 'yellow' }
  if (percent >= 25) return { icon: '☁', label: '多雲', color: 'cyan' }
  return { icon: '☀', label: '晴', color: 'green' }
}

export const sparkline = (percents: readonly number[]): string =>
  percents
    .map(p => BARS[Math.min(BARS.length - 1, Math.floor((Math.max(0, p) / 100) * BARS.length))])
    .join('')

export const shortTokens = (n: number): string => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return `${n}`
}

export const signedTokens = (n: number): string =>
  n >= 0 ? `+${shortTokens(n)}` : `-${shortTokens(-n)}`

export const bar = (percent: number, width = 10): string => {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const duration = (ms: number): string => {
  const m = Math.max(0, Math.floor(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

/** 依用量決定顏色：低於 50% 綠、低於 80% 黃，其餘紅。 */
export const loadColor = (percent: number): string =>
  percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green'

export const limitLabel = (kind: string): string =>
  kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7d' : kind

/** 從 .git/HEAD 的內容取出分支名稱；detached HEAD 回前 7 碼。 */
export const branchFromHead = (head: string): string | null => {
  const text = head.trim()
  const ref = /^ref: refs\/heads\/(.+)$/.exec(text)
  if (ref) return ref[1] ?? null
  return /^[0-9a-f]{7,}$/.test(text) ? text.slice(0, 7) : null
}
