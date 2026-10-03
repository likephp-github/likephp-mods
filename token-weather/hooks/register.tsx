import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Info, Reading } from '../types'
import {
  bar,
  branchFromHead,
  duration,
  forecast,
  limitLabel,
  loadColor,
  shortTokens,
  signedTokens,
  sparkline,
} from './forecast'

const HISTORY = 12
const TICK_MS = 30_000

const readings = atom({ plugin: 'token-weather', key: 'readings' } as const, [])
const isHidden = atom({ plugin: 'token-weather', key: 'isHidden' } as const, false)
const info = atom({ plugin: 'token-weather', key: 'info' } as const, null)
const now = atom({ plugin: 'token-weather', key: 'now' } as const, 0)

async function readBranch($: EngineInterface, root: string) {
  const head = await $.fs.read(`${root}/.git/HEAD`).catch(() => '')
  return branchFromHead(head)
}

async function refresh($: EngineInterface, usage: SessionUsage) {
  const repo = await $.session.repo()
  const root = repo?.root ?? (await $.session.root())
  const next: Info = {
    model: await $.session.model(),
    project: root.split('/').filter(Boolean).pop() ?? root,
    branch: repo === null ? null : await readBranch($, repo.root),
    startedAt: usage.startedAt,
    limits: usage.rateLimits.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt })),
    costUsd: usage.cost?.usd,
  }
  const t = await $.clock.now()
  await update($, info, () => next)
  await update($, now, () => t)
}

async function record($: EngineInterface, usage: SessionUsage) {
  const { tokens, percent, window } = usage.context
  if (tokens === undefined || percent === undefined) return

  const reading: Reading = { percent, tokens, window }
  await update($, readings, list => {
    const last = list[list.length - 1]
    const isSame = last !== undefined && last.tokens === tokens
    return isSame ? list : [...list, reading].slice(-HISTORY)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'token-weather',
      description: '切換 context 天氣預報（on / off / status）',
    })
    await refresh($, await $.session.usage())
    $.clock.every(TICK_MS, async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const usage = await $.session.usage()
    if (e.changed.includes('context')) await record($, usage)
    await refresh($, usage)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const usage = await $.session.usage()
    await record($, usage)
    await refresh($, usage)

    return next(e)
  })

  on('command.run', { command: 'token-weather' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'status') {
      const list = await read($, readings)
      const last = list[list.length - 1]
      const shown = (await read($, isHidden)) ? '隱藏中' : '顯示中'

      if (last === undefined) {
        return { text: `Token Weather ${shown}，尚無資料（完成一輪對話後才會有）。` }
      }

      const w = forecast(last.percent)

      return {
        text: `Token Weather ${shown}：${w.icon} ${w.label} ${last.percent}%（${shortTokens(last.tokens)}/${shortTokens(last.window)}）`,
      }
    }

    const hide = arg === 'off' ? true : arg === 'on' ? false : !(await read($, isHidden))
    await update($, isHidden, () => hide)

    return { text: hide ? 'Token Weather 已關閉。' : 'Token Weather 已開啟。' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const list = await read($, readings)
    const meta = await read($, info)
    const t = await read($, now)
    const last = list[list.length - 1]

    if (last === undefined && meta === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const prev = list[list.length - 2]
    const delta = last !== undefined && prev !== undefined ? last.tokens - prev.tokens : undefined
    const w = last === undefined ? undefined : forecast(last.percent)

    return (
      <Box flexDirection="column">
        <Box>
          {last === undefined || w === undefined ? (
            <Text dimColor>☁ 等待第一個回應…</Text>
          ) : (
            <Box>
              <Text color={w.color} bold>
                {w.icon} {w.label} {last.percent}%
              </Text>
              <Text dimColor>
                {'  '}
                {shortTokens(last.tokens)}/{shortTokens(last.window)}
                {'  '}
              </Text>
              <Text color={w.color}>{sparkline(list.map(r => r.percent))}</Text>
              {delta !== undefined && <Text dimColor>{'  '}上一輪 {signedTokens(delta)}</Text>}
            </Box>
          )}
        </Box>
        {meta !== null && (
          <Box>
            <Text wrap="truncate-end">
              <Text color="cyan">[{meta.model}]</Text>
              <Text dimColor> │ </Text>
              <Text>{meta.project}</Text>
              {meta.branch !== null && <Text color="magenta"> ({meta.branch})</Text>}
              {meta.limits.map(l => (
                <Text key={l.kind}>
                  <Text dimColor> │ {limitLabel(l.kind)} </Text>
                  <Text color={loadColor(l.percent)}>
                    {bar(l.percent, 8)} {l.percent}%
                  </Text>
                  {l.resetsAt !== undefined && (
                    <Text dimColor> ({duration(Date.parse(l.resetsAt) - t)}後重置)</Text>
                  )}
                </Text>
              ))}
              <Text dimColor> │ ⏱ {duration(t - meta.startedAt)}</Text>
              {meta.costUsd !== undefined && <Text dimColor> │ ${meta.costUsd.toFixed(2)}</Text>}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
