/**
 * 单原生 Modal 仲裁器（Seeora）
 *
 * 不变量：**任意时刻最多只有一个 Sheet 的 <Modal> 处于挂载状态。**
 *
 * 为什么必须有这条不变量
 * ───────────────────────────────────────────────────────────────
 * RN 0.83 上两个原生 Modal 并存（嵌套或平级）都会留下一个**全屏透明 VC**：
 * 关掉之后整页失去响应（触摸被吃、不能滚动、返回键失效）。
 * 本项目的「链式弹层」正好会踩到：
 *   · 习惯编辑弹层 → 删除确认（ConfirmDialog）
 *   · 习惯编辑弹层 → 7 天补录（Backfill）
 * 前者的退场动画要 270ms（duration.d1 150 + 120 兜底），这 270ms 内它的 Modal
 * 仍然存活，与后开的弹层重叠。
 *
 * 机制（两步，缺一不可）
 * ───────────────────────────────────────────────────────────────
 * 1. 新弹层 `claimSheet()` 抢先登记 token，然后 `announceSheet()` 通知所有弹层；
 *    非最新 token 的弹层**立刻** setMounted(false)（跳过退场动画 —— 反正马上
 *    被新弹层的遮罩盖住，看不出差别），并归还自己的 token。
 * 2. `claimSheet()` 返回的 `others > 0`（说明有弹层正被顶替）时，新弹层把自己的
 *    Modal **延后一个宏任务**再挂载。React 被动 effect 引发的重渲染走微任务，
 *    必然先于 setTimeout(0) 的宏任务落地 —— 因此「旧 Modal 卸载」确定发生在
 *    「新 Modal 挂载」之前，原生 present/dismiss 的顺序不再靠运气。
 *    无并发弹层时（绝大多数情况）不延后，零额外延迟。
 *
 * 为什么不用「弹层内多步骤」一劳永逸：删除确认原先走 store 的
 * askDelete/doDelete（pendingDel + confirmVisible），改成内联步骤要重写这条
 * 数据通路；仲裁器把改动收敛在一个文件里，风险更小。
 * ★ 2026-10-06 更新：那条通路**已经**按这个思路重写完了 ——
 *   删除确认改成了 HabitForm 内的就地二次确认（见 components/HabitForm.tsx 的 DeleteConfirm），
 *   「关表单 → 开确认层」的链式场景不复存在。仲裁器仍然必须保留：
 *   HabitForm → 补录（openBackfill、先 closeHabitForm）依然是链式弹层，
 *   而「退场动画期间仍持有代号」正是这条不变量在兜底。
 */

type Listener = (top: number) => void;

/** 单调递增的代号：越大越新 */
let seq = 0;
/** 当前存活（Modal 已挂载）的弹层代号 */
const alive = new Set<number>();
const listeners = new Set<Listener>();

export interface ClaimResult {
  token: number;
  /** claim 时已有的存活弹层数（> 0 表示本次是「顶替」，调用方需延后一帧挂载） */
  others: number;
}

/** 登记一层新弹层。调用方拿到 token 后必须立刻 `announceSheet()`。 */
export function claimSheet(): ClaimResult {
  seq += 1;
  const others = alive.size;
  alive.add(seq);
  return { token: seq, others };
}

/** 归还代号（Modal 已卸载时调用） */
export function releaseSheet(token: number): void {
  if (token) alive.delete(token);
}

/** 通知所有弹层：当前最新代号是 seq，不是自己的就让位 */
export function announceSheet(): void {
  listeners.forEach((l) => l(seq));
}

export function subscribeSheet(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
