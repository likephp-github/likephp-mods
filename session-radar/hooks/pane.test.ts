import { expect, mock, test } from 'claude-code/testing'

const PANE_PROPS = {
  title: 'Claude Sessions',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as never

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：面板畫得出清單與老虎`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const ui = await $.ui.mount({
      plugin: 'session-radar',
      surface,
      component: 'Pane',
      requestId: 'session-radar',
      props: PANE_PROPS,
    })
    expect(await ui.find({ text: /個 session/ })).toBeDefined()
    expect(await ui.find({ text: /z/ })).toBeDefined()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：面板很矮時只畫草也不會出錯`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const ui = await $.ui.mount({
      plugin: 'session-radar',
      surface,
      component: 'Pane',
      requestId: 'session-radar',
      props: { ...(PANE_PROPS as object), scroll: { offset: 0, bodyRows: 6 } } as never,
    })
    expect(await ui.find({ text: /個 session/ })).toBeDefined()
    expect(await ui.find({ text: /z/ })).toBeDefined()
  })
}
