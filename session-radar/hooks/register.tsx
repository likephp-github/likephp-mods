import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Peer, Tiger } from '../types'
import { jumpTo, messageFor } from './jump'
import type { Run } from './jump'
import { ago, hotkeys, look, parsePeer, parseSessionsArgs, peerForKey, sortPeers } from './sessions'
import { paneFrame } from './frame'
import { stamp } from './scene'
import { SLEEP, factorFor, joinCells, modeFor, spriteWidth, step, toCells } from './tiger'

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

/** 跳到 peer 所在的終端機；失敗時用 toast 告訴使用者下一步，細節寫到 debug log。 */
/** 跳到 peer 所在的終端機；回傳給使用者看的提示（成功時 undefined），錯誤細節寫到 debug log。 */
async function jump($: EngineInterface, peer: Peer, inTmux: boolean): Promise<string | undefined> {
  const run: Run = argv => $.process.run(argv)
  const outcome = await jumpTo(peer.pid, run, { inTmux })
  if (outcome.kind === 'error') $.ui.log(`session-radar 切換到 ${peer.name} 失敗：${outcome.detail}`, { to: 'debug' })
  return messageFor(outcome)
}

/** 按下面板上的名稱：失敗時用 toast 提示。 */
async function jumpFromPane($: EngineInterface, peer: Peer, inTmux: boolean) {
  const message = await jump($, peer, inTmux)
  if (message !== undefined) $.ui.toast(message)
}

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
  let inTmux = false
  let room = 0
  let stride = 1

  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) ?? ''
    inTmux = ((await $.env.get('TMUX')) ?? '') !== ''
    const id = await $.session.id()
    await update($, selfId, () => id)
    await $.command.register({
      name: 'sessions',
      description: '開關側邊面板：本機所有 Claude session 的狀態；/sessions 1～9 跳到該編號的 session',
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

  on('command.run', { command: 'sessions' }, async ($, e) => {
    const cmd = parseSessionsArgs(e.args)

    if (cmd.kind === 'usage') {
      return { text: '用法：/sessions 開關面板；/sessions 1～9 跳到面板上該編號的 session。' }
    }

    if (cmd.kind === 'jump') {
      await scan($, home)
      const peer = peerForKey(await read($, peers), await read($, selfId), cmd.key)
      if (peer === undefined) return { text: `沒有編號 ${cmd.key} 的 session。` }
      return { text: (await jump($, peer, inTmux)) ?? `已切換到 ${peer.name}。` }
    }

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
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, peers)
    const me = await read($, selfId)
    const now = await read($, checkedAt)
    const busy = list.filter(p => p.status === 'busy').length
    const keys = hotkeys(list, me)
    const cat = await read($, tiger)
    const columns = e.props.bodyColumns
    const factor = factorFor(cat.percent, columns, TIGER_WIDTH)
    const mode = modeFor(cat.isWorking, cat.idleSince, await $.clock.now())
    const listRows = 1 + Math.max(1, list.length)
    const frame = paneFrame({ mode, x: cat.x, facing: cat.facing, frame: cat.frame, factor, columns, rows: e.props.scroll.bodyRows - listRows })
    room = frame.room
    stride = frame.stride
    const cells = frame.marks.reduce((c, m) => stamp(c, frame.sprite, m.line, m.col, m.text, m.color), toCells(frame.sprite))
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
          const key = keys[peer.sessionId]
          const detail = (
            <Text dimColor wrap="truncate-end">
              {' '}
              {l.label} {ago(peer.since, now)}
              {peer.kind === 'bg' ? ' 背景' : ''}
            </Text>
          )

          // 本視窗那一行只是看的；其他 session 的名稱是按鈕，按了跳過去
          return isMe ? (
            <Text key={peer.sessionId} wrap="truncate-end">
              <Text color={l.color}>{l.icon}</Text>{' '}
              <Text bold color="blue">
                {peer.name}
              </Text>
              {detail}
            </Text>
          ) : (
            <Box key={peer.sessionId} flexDirection="row">
              <Text color={l.color}>{l.icon} </Text>
              <Button key={`jump-${peer.sessionId}`} plain hotkey={key} label={peer.name} onPress={() => jumpFromPane($, peer, inTmux)} />
              {detail}
            </Box>
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
