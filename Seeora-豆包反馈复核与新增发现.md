# Seeora × 豆包反馈复核 + 新增实证发现

日期：2026-10-02
复核对象：豆包对我方《Seeora-对照RockSort上架经验-核查报告》的评审意见
复核方式：**只读源码 + 依赖产物逐行核验**，不改代码、不打包
本轮同时执行的动作：`app.json` 的 `ios.buildNumber` `"2"` → `"1"`（已还原，工作区 diff 为空）

---

## 一、结论速览

| # | 豆包观点 | 裁定 | 依据 |
|---|---|---|---|
| 1 | 报告可信、方法符合"实测不猜" | ✅ 成立 | 每条判定均落到源码行号，离线可坐实的与需真机的分开表述 |
| 2 | 头号风险是 reanimated 版本矩阵 | ✅ 成立 | 同 RockSort 实测"能编译、冷启动仍崩"组合 |
| 3 | 优先级应再分一档：诊断副作用/深色对比/内购静默排最前；reanimated 是"第一件要验证的"而非"第一批要改的" | ⚠️ 方向成立，**进度已过时** | 这三处**已落地**（commit `ce348a3`），豆包按"尚未动手"给建议 |
| 4 | 别急着改代码，先打 demo 包真机验冷启动 | ✅ 顺序正确，也正是我方保留的顺序 | 刻意未升 reanimated、未摘诊断插件 |
| 5 | 清单 5–10 项可留到下版本，不卡提审 | ⚠️ 部分已改 / 部分同意 | `all[0]`、`price numberOfLines`、`name/version` **已改**；死依赖确同意留后 |
| 6 | 盲区：报告只对照 RockSort，覆盖不到 Seeora 独有新生问题 | ✅ **成立，且已被本轮实证** | 见下方 🔴 新增发现，正是 Seeora 独有 |
| 7 | 三项必须真机（冷启动、/pro 弹层交互、Toast 可见） | ⚠️ **范围可缩小到 1.5 项** | 见第三节 |
| 8 | 「要不要我先把②–⑤低成本修改落到文件改法」 | ❌ 已不需要 | 已在 `ce348a3` 完成 |

---

## 二、🔴 本轮新增实证发现（豆包盲区的现实证据）

### 发现 A：买断/恢复失败的 Toast 在 iOS 上**必然被弹层盖住 → 用户看不到**

**这不是推测，是结构性确定。**

链路（逐行核验）：

1. `src/app/pro.tsx:83` — Pay Sheet 用项目内 `Dialog`（`@/components/ui/dialog`）承载，`<Dialog open={payVisible} onOpenChange={(o) => !o && closePay()}>`。
2. `src/components/ui/dialog.tsx:19,29,46` — `DialogOverlay` 在 iOS 上被包进
   `FullWindowOverlay`（来自 `react-native-screens`）：
   ```tsx
   const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;
   ```
   **含义：iOS 上弹层被渲染到一个独立 UIWindow，位于 App 主 window 之上。**
3. `src/app/_layout.tsx:56-59` — 全局 Toast 挂载位置：
   ```tsx
   {children}
   <ToastHost />      {/* ← 普通视图树，主 window 内 */}
   <ConfettiHost />
   <ModalHost />
   <PortalHost />
   ```
4. `src/components/Toast.tsx:48` — Toast 靠 `zIndex: 999` 抬高。

**冲突点**：`zIndex` 只在**同一个 window 内**有效，**无法跨越 UIWindow**。弹层在独立 UIWindow（层级更高），Toast 在主 window（层级更低）→ **无论 zIndex 调多大，Toast 都会被弹层整层压住**。

**叠加放大的第二处**：`src/store/usePro.ts:49`
```ts
const ok = await purchasePlan(payPlan);
if (!ok) { showToast(dict.payBuyFail); return; }   // ← Pay Sheet 没有关闭
```
失败路径**不关弹层**，于是 Toast 在弹层背后 → 用户视角＝**"点了买断没反应"**。
这恰恰是 `ce348a3` 想修的那个"静默失败"，**修复动作已执行但效果被层级吞掉**（对比度修好了，可见性没修好）。

`payRestore` 同理（`usePro.ts:67-68`）。

**修复前的现象**：静默（无提示）。
**修复后的现象**：有提示，但被盖住 → **看起来仍像静默**。
**结论**：这一项**仍是未完成状态**，不能记为已修。

**对照**：成功路径 `usePro.ts:52-54` 先 `setPayVisible(false)` 再 `showToast(proOwned, true)` → 弹层已卸载 → Toast 可见 ✅。**问题只出在两条失败路径。**

**平台差异**：Android 上 `FullWindowOverlay` 被替换为 `React.Fragment`（同一视图树），Toast 的 `zIndex 999` > 弹层 `z-50` → Android 可见；**iOS 不可见**。而目标市场是 iOS 上架 → 必须修。

---

### 发现 B：`buildNumber` 的"2"很可能不是手改，且还原后下次构建仍会变回 2

`eas.json`：
```json
"cli": { "appVersionSource": "local" },
"build": { "production": { "autoIncrement": true, ... } }
```

- `appVersionSource: "local"` + `autoIncrement: true` ⇒ 每次构建前，EAS 会读**本地 `app.json`** 的 `buildNumber` 并**自动 +1**（写回本地产物版本）。
- 因此：本地现在写 `"1"`，**下一次构建产物的 buildNumber 仍会是 `"2"`**。
- 推论：上次 `eas build` 跑起来后失败，`"2"` 更可能就是 **CLI 自动递增后写回的**，而非人工手改。

**要拍板的分叉**（两个都安全，因为 ASC 里 `1.0.0` 一个 build 都没有）：

| 选择 | 做法 | 结果 |
|---|---|---|
| 甲 | 保持 `autoIncrement: true` | 这次产物 buildNumber = **2**（1 号永远空缺，无害） |
| 乙 | 改 `eas.json` 为 `"autoIncrement": false` | 这次产物 buildNumber = **1**（符合"还原成 1"的完整语义） |

⚠️ 若目标是"产出的包构建号就是 1"，**只改 `app.json` 不够**，必须同时动 `eas.json`。这是构建配置改动，按规矩先报不动。

---

## 三、离线坐实 vs 真机待验：范围修正

豆包把三项平列为"必须真机"。本轮核验后可以收窄：

| 项 | 豆包判定 | 最新边界 | 离线依据 |
|---|---|---|---|
| **Toast 可见** | 必须真机 | ✅ **已离线坐实**（且结论是"不可见"） | 对比度公式复算（1.09→16.83）+ window 层级确定 |
| **/pro 弹层交互** | 必须真机 | ⚠️ **只剩 1 小点需真机** | 见下 |
| **reanimated 冷启动** | 必须真机 | ✅ 同意，**唯一无法离线判定的** | 需真机冷启动 |

**/pro 弹层交互**的离线核验（`node_modules/@rn-primitives/dialog/dist/dialog.js`）：

```js
function Portal({ forceMount, hostName, children }) {
  const value = useRootContext();
  if (!forceMount) {
    if (!value.open) { return null; }      // ← 关闭即卸载子树
  }
  ...
}
```
`Overlay`（L140-144）、`Content`（L162-166）同样是 `!open → return null`。
pro.tsx 未传 `forceMount` ⇒ **弹层关闭时 Portal/Overlay/Content 全部卸载 → `FullWindowOverlay` 随之销毁。**

这直接排除了该结构最凶的症状——**"关掉付费弹层后整页失去响应"（残留 UIWindow 吞触摸）**。

**残留的真机风险（仅此一点）**：`DialogOverlay` 里套了两层带 `exiting={FadeOut}` 的 `NativeOnlyAnimatedView`（`dialog.tsx:40-44`，总时长约 200ms）。卸载期这扇窗口极短，理论上有一次性触摸拦截窗口。**真机只需验"关弹层后立刻滑动/点按是否跟手"这一下**，不必把整块交互列为未知。

**另一处需真机确认的导航事实**：全项目 **0 处 `presentation` 配置**，根 `_layout.tsx` 未声明 `Stack`；而 `pro.tsx:3` 注释写"以 modal 路由呈现"。即注释与实现不符，`/pro` 很可能只是普通 push 而非 iOS 原生 modal。影响：`closePro()` 里的 `nav.back()` 行为、以及 `/pro` 页面的滑动手势预期，需真机确认。

---

## 四、待哥哥拍板（不含打包）

1. **发现 A 的修法**（二选一）：
   - **甲·最小改动**：失败两条路径改成先关弹层再提示——`usePro.ts:49` 加 `setPayVisible(false);`，`usePro.ts:67-68` 前同样加。弹层卸载后 Toast 可见。代价：用户需重开弹层才能重试。
   - **乙·体验更好**：失败时不关弹层，在 `DialogContent` 内联一行错误文案（复用现有 i18n key，新增一个错误 state）。用户可原地重试。改动略大，但审核体验最佳。
2. **发现 B 的分叉**：`autoIncrement` 保留（产物号=2）还是关掉（产物号=1）。
3. **未动项确认**：死依赖（`react-native-ui-datepicker`、`Leaderboard.tsx`、`swipeBus.ts`）按豆包意见留到下版本——是否同意。
4. **打包**：等哥哥明确命令，本轮不动。

---

## 五、本轮未做

- 未改任何源码（除 `app.json` 的 buildNumber 还原）
- 未改 `eas.json`
- 未打包、未触发任何构建
- 未删除任何文件/依赖
