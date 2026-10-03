import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Peer, Tiger } from '../types'
import { ago, look, parsePeer, sortPeers } from './sessions'
import { composeScene, fitsTrees, stamp } from './scene'
import { FLIGHT_ROOM, PAW_ROW, PLAY_STEPS, SLEEP, WALK, sleepPose, factorFor, flight, joinCells, mirror, modeFor, sized, snore, spriteWidth, step, toCells } from './tiger'

const PANE = 'session-radar'
const TITLE = 'Claude Sessions'
const POLL_MS = 3000
const FRAME_MS = 400
const TIGER_WIDTH = spriteWidth(SLEEP)

const peers = atom({ plugin: 'session-radar', key: 'peers' } as const, [])
const selfId = atom({ plugin: 'session-radar', key: 'selfId' } as const, '')
const checkedAt = atom({ plugin: 'session-radar', key: 'checkedAt' } as const, 0)
const tiger = atom({ plugin: 'session-radar', key: 'tiger' } as const, {
  isWorking: false,
  idleSince: 0,
  frame: 0,
  x: 0,
  facing: 1,
} as Tiger)

async function scan($: EngineInterface, home: string) {
  const dir = `${home}/.claude/sessions`
  const entries = await $.fs.list(dir).catch(() => [])
  const found: Peer[] = []

  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    const text = await $.fs.read(`${dir}/${entry.name}`).catch(() => '')
    const peer = parsePeer(text)
    if (peer !== undefined) found.push(peer)
  }

  const now = await $.clock.now()
  await update($, peers, () => sortPeers(found))
  await update($, checkedAt, () => now)
}

/** 動畫的一格：工作中往前走一步，睡覺時只推進打呼的節奏。面板沒開就不動。 */
async function tick($: EngineInterface, room: number, stride: number) {
  const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (!isOpen) return

  await update($, tiger, t => {
    const walked = t.isWorking ? step({ x: t.x, facing: t.facing }, room, stride) : t
    return { ...t, x: walked.x, facing: walked.facing, frame: t.frame + 1 }
  })
}

export const register: Register = on => {
  let home = ''
  let room = 0
  let stride = 1

  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) ?? ''
    const id = await $.session.id()
    await update($, selfId, () => id)
    await $.command.register({
      name: 'sessions',
      description: '開關側邊面板：本機所有 Claude session 的狀態',
    })
    await scan($, home)
    $.clock.every(POLL_MS, () => scan($, home))
    const { context } = await $.session.usage()
    await update($, tiger, t => ({ ...t, isWorking: false, percent: context.percent }))
    $.clock.every(FRAME_MS, () => tick($, room, stride))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, tiger, t => ({ ...t, isWorking: true }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const t = await $.clock.now()
      await update($, tiger, cat => ({ ...cat, isWorking: false, idleSince: t }))
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const { percent } = e.context
    if (percent !== undefined) {
      await update($, tiger, t => ({ ...t, percent }))
    }

    return next(e)
  })

  on('command.run', { command: 'sessions' }, async $ => {
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)

    if (isOpen) {
      await $.ui.close({ id: PANE })

      return { text: 'Claude Sessions 面板已關閉。' }
    }

    await scan($, home)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Claude Sessions 面板已開啟。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, peers)
    const me = await read($, selfId)
    const now = await read($, checkedAt)
    const busy = list.filter(p => p.status === 'busy').length
    const cat = await read($, tiger)
    const columns = e.props.bodyColumns
    const factor = factorFor(cat.percent, columns, TIGER_WIDTH)
    const mode = modeFor(cat.isWorking, cat.idleSince, await $.clock.now())
    const base =
      mode === 'walk' ? WALK[cat.frame % WALK.length] : mode === 'play' ? PLAY_STEPS[cat.frame % PLAY_STEPS.length] : sleepPose(cat.frame)
    const pose = sized(base ?? SLEEP, factor)
    const width = spriteWidth(pose)
    room = Math.max(0, columns - width)
    stride = Math.max(1, Math.round(factor))
    // 抓蝴蝶時讓出前方空間給蝴蝶
    const x =
      mode !== 'play'
        ? Math.min(cat.x, room)
        : cat.facing === 1
          ? Math.max(0, Math.min(cat.x, columns - width - FLIGHT_ROOM))
          : Math.min(room, Math.max(cat.x, FLIGHT_ROOM))
    // 老虎疊在樹林前、站在草地上；背景位移跟著老虎實際畫出的 x
    const listRows = 1 + Math.max(1, list.length)
    const withTrees = fitsTrees(e.props.scroll.bodyRows, listRows, pose.length)
    const scene = composeScene({ pose: cat.facing === 1 ? pose : mirror(pose), x, columns, withTrees })
    const tigerLine = Math.floor(scene.top / 2)
    const pawLine = Math.floor((scene.top + Math.floor(PAW_ROW * factor)) / 2)
    const fly = flight(cat.frame, pawLine - tigerLine)
    // 蝴蝶的欄位：老虎面向哪邊，就在那一側的身體前緣外
    const flyAt = cat.facing === 1 ? x + width + fly.col : x - fly.glyph.length - fly.col
    const zzz = snore(cat.frame)
    const zzzAt = Math.min(Math.max(0, x + width - zzz.length), columns - zzz.length)
    // 頭頂那一行：睡覺時打呼，抓蝴蝶時蝴蝶在頭頂或掌邊，符號直接蓋在背景上
    const cells =
      mode === 'sleep'
        ? stamp(toCells(scene.sprite), scene.sprite, tigerLine - 1, zzzAt, zzz, 'cyan')
        : mode === 'play'
          ? stamp(toCells(scene.sprite), scene.sprite, tigerLine + fly.row, flyAt, fly.glyph, fly.isHit ? 'yellow' : 'magenta')
          : toCells(scene.sprite)
    const lines = joinCells(cells)
    // 把場景推到面板最底：可見列數扣掉清單與場景佔的列數，剩下的補空行
    const gap = Math.max(1, e.props.scroll.bodyRows - listRows - lines.length)

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {list.length} 個 session · {busy} 個工作中 · 藍色為本視窗
        </Text>
        {list.length === 0 && <Text dimColor>找不到任何 session。</Text>}
        {list.map(peer => {
          const l = look(peer.status)
          const isMe = peer.sessionId === me

          return (
            <Text key={peer.sessionId} wrap="truncate-end">
              <Text color={l.color}>{l.icon}</Text>{' '}
              <Text bold={isMe} color={isMe ? 'blue' : undefined}>
                {peer.name}
              </Text>
              <Text dimColor>
                {' '}
                {l.label} {ago(peer.since, now)}
                {peer.kind === 'bg' ? ' 背景' : ''}
              </Text>
            </Text>
          )
        })}
        {Array.from({ length: gap }, (_, i) => (
          <Text key={`gap${i}`}> </Text>
        ))}
        {lines.map((runs, row) => (
          <Text key={`t${row}`} wrap="truncate-end">
            {runs.map((r, i) => (
              <Text key={`r${row}-${i}`} color={r.fg} backgroundColor={r.bg}>
                {r.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )
  })
}
