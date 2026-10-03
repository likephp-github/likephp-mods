import { expect, test } from 'claude-code/testing'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：還沒有任何資料時也顯示等待提示`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'token-weather',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false } as never,
    })
    expect(await ui.find({ text: /等待第一個回應/ })).toBeDefined()
  })
}
