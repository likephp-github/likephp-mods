# likephp-mods

Claude Code 的 mod 集合；目前主要是 session-radar：側邊面板列出本機所有 Claude session，底部有隨 session 狀態演出的像素角色。

## Language

### session-radar 面板底部

**主題**:
面板底部演出的一組角色、背景，與它們在各個狀態下的動作。目前有「小老虎」（`tiger`，預設）與「綠雲與愛心」（`puma`）；使用者選的主題跨 session 記住。
_Avoid_: skin、角色包、cloud（指綠雲與愛心主題時）

**狀態**:
目前這個 session 的活動程度，與主題無關；只有 `working`（工作中）、`resting`（閒置 30 秒內）、`idle`（閒置超過 30 秒）三種。
_Avoid_: mode、walk / play / sleep（這些是老虎的動作名稱，不是狀態）

**動作**:
某個主題在某個狀態下演出的內容，例如老虎在 `resting` 時抓蝴蝶、綠雲在 `idle` 時吃丸子。
_Avoid_: pose（pose 是單格畫面）

**背景**:
主題的一部分，角色身後的景物；小老虎是樹林與草地，綠雲與愛心是閃爍的星空。
_Avoid_: scene（scene 是背景加角色合成後的整格畫面）

**名言**:
綠雲與愛心主題在 `resting` 時，頭頂對話框顯示的一句話，每進入一次 `resting` 隨機挑一句。
_Avoid_: quote bubble、台詞
