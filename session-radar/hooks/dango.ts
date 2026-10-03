/**
 * 三色丸子（手畫）：粉、白、綠三顆串在竹籤上，綠雲在 idle 時從最上面一顆顆吃掉。
 * 顏色字元用 puma 調色盤（見 puma-sprites.ts）：P 粉、I 白、C 綠、D 竹籤。
 */
type Sprite = readonly string[]

const STICK = '.D.'

/** 竹籤由上往下：粉、白、綠各兩列，最下面一列是手拿的竹籤尾端。 */
const BALLS = ['PPP', 'PPP', 'III', 'III', 'CCC', 'CCC']

/** 吃掉最上面 eaten 顆，被吃掉的位置露出竹籤。 */
const bite = (eaten: number): Sprite => [...BALLS.map((row, y) => (y < eaten * 2 ? STICK : row)), STICK]

/** 4 個階段：剩 3、2、1、0 顆。 */
export const DANGO: readonly Sprite[] = [bite(0), bite(1), bite(2), bite(3)]
