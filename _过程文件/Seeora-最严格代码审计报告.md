# Seeora 最严格代码审计报告

- **审计对象**：`D:\Desktop\习惯927\native`（Expo SDK 55 / RN 0.83.2 / expo-router）
- **审计基线**：工作区未提交改动 = 上一轮「付费模块复用 RockSort + 6 处弹层统一改造」的全部产物
  - HEAD = `ce348a3`（上架复核 P0/P1 修复）
  - 本轮新增 4 个文件：`Sheet.tsx` / `sheetArbiter.ts` / `payTrace.ts` / `useReduceMotion.ts`
  - 本轮修改 9 个文件：`pro.tsx` / `ExportSheet.tsx` / `HabitForm.tsx` / `HonorForm.tsx` / `ModalHost.tsx` / `Toast.tsx` / `i18n.ts` / `app.tsx` / `usePro.ts`
- **审计方式**：逐行阅读 + 调用链反查（grep 全量消费者）+ 工具链实跑（tsc / jest / oxlint / biome）
- **审计时间**：2026-10-02 17:30–17:50 GMT+8
- **未打包、未提交、未改任何业务代码**

---

## 0. 审计范围（先说清楚边界）

**已逐字覆盖**：本轮 13 个改动文件 + 其直接依赖链：
`src/lib/iap.ts`、`src/store/useHabitActions.ts`、`src/lib/tokens.ts`、`src/lib/appleDesign.ts`、`src/lib/i18n.ts`、`src/components/Confetti.tsx`、`src/app/_layout.tsx`、`src/app/habit/[id].tsx`、`src/components/HabitRow.tsx`

**未逐字覆盖**（本轮未改动，仅按需局部查阅）：
`dates.ts`、`habitLogic.ts`、`storage.ts`、`notify.ts`、`usePersist.ts`、`theme.ts`、`haptic.ts`、`share.tsx`、`settings.tsx`、`today.tsx`、`history.tsx`、`index.tsx`、`onboarding.tsx`、`BuyoutCard.tsx`，以及 `src/components/ui/**`（Radix 移植层，共 30+ 文件）。
→ **这部分需要单独一轮才能做到真正「逐字」**，本报告不对它们下结论。

---

## 1. 工具链真实基线（含一次重要的自我纠正）

### ⚠️ 1.1 `npm run lint` 在本机是**假阳性**，不能作为门禁

`devkit-lint` 的调度逻辑（`node_modules/miaoda-expo-devkit/dist/cli/lint.js:17388`）：

```js
function run(name, cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });   // ← 无 shell:true
  results.push({ name, ok: (r.status ?? 1) === 0 });      // ← status 为 null 即判失败
}
```

本机实测（`node -e` 直接调用）：

| 命令 | status | error |
|---|---|---|
| `oxlint` | `null` | **EBUSY** |
| `biome` | `null` | **EBUSY** |
| `tsc` | `null` | **EBUSY** |

三个子进程**全部启动失败**（`node_modules/.bin/` 下只有无扩展名 shell wrapper 与 `.cmd`，`spawnSync` 不带 shell 无法执行）→ `status ?? 1` → 全部判 `ok:false` → 输出

```
RESULT: FAILED — Found errors in: oxlint, biome, tsc
```

**这不是代码问题，是运行环境问题。** 结论：`npm run lint` 当前**无法用于验证**。要拿真实结论，只能手工复现 runner 的等价命令。

### 1.2 手工复现的三个真实基线

| 工具 | 等价命令 | 真实结果 |
|---|---|---|
| TypeScript | `tsc --noEmit` | ✅ **0 错误** |
| Biome | `biome lint --config-path <devkit>/biome-config.json .` | ✅ **0 错误**（79 files） |
| oxlint | `oxlint --config <devkit>/oxlint-config.json --ignore-pattern … .` | ❌ **120 errors** |
| Jest | `jest` | ✅ **24/24 通过** |

### 1.3 oxlint 的 120 errors 拆解（关键：115 条是工具配置噪音）

| 数量 | 规则 | 位置 | 性质 |
|---|---|---|---|
| 103 | `eslint(no-undef)` | `src/lib/__tests__/habitLogic.test.ts` | **配置缺陷**：oxlint config 未声明 jest globals（`expect`/`describe`/`it`） |
| 12 | `eslint(no-undef)` | `plugins/withFmtConstevalFix.js`(5)、`plugins/turboModuleFix/withTurboModuleFix.js`(5)、`plugins/crashReason/withCrashReason.js`(2) | **配置缺陷**：未声明 CommonJS `module` |
| **5** | **`rn-pressable-style(no-pressable-function-style)`** | `HabitRow.tsx:36`、`habit/[id].tsx:160,234`、`share.tsx:230,245` | **真实代码问题**（见 §5.1） |

**115 条 `no-undef` 无法在项目侧消除**：`--config` 硬指向 `node_modules/miaoda-expo-devkit/oxlint-config.json`，项目无覆盖入口。
**后果很严重**：这 115 条噪音把 5 条真实问题完全淹没 —— 这也是为什么此前没人发现 `rn-pressable-style`。

### 1.4 额外的（非 lint 项）提示

`biome check .`（含 assist 规则，runner 不用这个模式）另有 **59 个 `organizeImports`** 提示，**遍布全项目**，包含我从未碰过的 `src/lib/utils.ts`、`src/components/ui/button.tsx`、`src/lib/tokens.ts` 等。
→ **属于既有基线，非本轮引入**；runner 只跑 `biome lint`，不影响门禁。

---

## 2. 🔴 P0 —— 审核员/用户会直接撞上

### P0-1 免费版第 6 个习惯的**购买入口打不开**（付费转化路径断裂）

**位置**：`src/store/useHabitActions.ts:212-218`

```ts
if (!pro && habits.length >= FREE_HABIT_LIMIT) {
  openPay();                                   // ← 只 setPayVisible(true)
  showToast(lang === "zh" ? "免费版可创建 5 个习惯。买断一次，永久不限数量。" : "...");
  return;
}
```

**证据**：全项目 `payVisible` 的唯一消费者是 `/pro` 路由页：

```tsx
// src/app/pro.tsx:137-143
<Sheet visible={payVisible} onClose={closePay} center backdropClosable={!paying && !restoring} debugName="pay">
```

`openPay` 的实现（`src/store/usePro.ts:59`）只有一行 `setPayVisible(true)`，**不 push 路由**。

**后果**：用户在 Today / 历史 / 设置页创建第 6 个习惯时 —— ProScreen 根本没挂载 → **弹层无处渲染** → 用户只看到一句 Toast，**购买入口不出现**，想买也无从点起。
（`useHabitActions.ts:28` 的类型注释写着「买断状态与买断弹层（用于…温和提示）」，说明作者意图是打开购买页，但接错了 API。）

**修复**：把 `openPay()` 换成 `openPro()`（`usePro.ts:49`，会 `setProVisible(true)` + `nav.push("/pro")`）。

---

### P0-2 `pro.tsx` 的失败文案会**跨弹层残留**

**位置**：`src/app/pro.tsx:36-38`

```tsx
// ★ 失败原因必须渲染在弹层**内部**：…
//   本组件随 payVisible 卸载，重新进入时状态天然归零，无需手动清理。
const [payErr, setPayErr] = useState("");
const [restoreErr, setRestoreErr] = useState("");
```

**这段注释的前提不成立。** `ProScreen` 是 `/pro` **路由页**，`payVisible` 只控制它内部的 `<Sheet>`；`payVisible` 变化**不会卸载 ProScreen**，因此 `payErr` / `restoreErr` **不会归零**。

**可复现路径**：
1. 打开买断弹层 → 点「买断永久使用」→ 失败 → `setPayErr("购买未完成。请检查网络或 App Store 付款设置后重试。")`
2. 用户点 ✕ 关闭弹层（`payErr` 仍在）
3. 再次打开弹层 → `{payErr ? <Text>…}` **立刻渲染上一次的失败文案** → 用户尚未操作就看到「购买未完成」

**修复**（二选一）：
```tsx
// 方案 A（推荐，1 行）：关闭即清
useEffect(() => { if (!payVisible) { setPayErr(""); setRestoreErr(""); } }, [payVisible]);
// 方案 B：在 onPay/onRestore 开头清两个 state
```

---

### P0-3 `iap.ts` 并发初始化竞态 —— **首次点买断可能必然失败**

**位置**：`src/lib/iap.ts:47-65`

```ts
let Purchases: any = null;
let purchasesLoaded = false;

async function getPurchases(): Promise<any> {
  if (purchasesLoaded) return Purchases;   // ← 第二次调用会在 import 完成前返回 null
  purchasesLoaded = true;
  if (!RC_KEY || Platform.OS === "web") return null;
  try {
    const mod: any = await import("react-native-purchases");   // ← 异步窗口
    Purchases = mod.default ?? mod;
    Purchases.configure({ apiKey: RC_KEY });
  } catch { Purchases = null; }
  return Purchases;
}
```

**两个并发调用者**：
- `usePlanPrices(payVisible)` → `src/lib/iap.ts:82`（弹层打开即触发）
- `purchasePlan()` → `src/lib/iap.ts:122`（用户点买断）

**竞态时序**：
1. 弹层打开 → `usePlanPrices` 调 `getPurchases()` → 置 `purchasesLoaded = true` → 开始 `await import(...)`（数百 ms）
2. 此时价格位还显示「价格加载中…」，但**买断按钮的 `disabled` 只绑 `paying`、不绑 `ready`**（`pro.tsx:176-181`）→ **可以点**
3. 用户/审核员点买断 → `purchasePlan` → `getPurchases()` → `purchasesLoaded` 已为 true → **立即返回 `null`**
4. `purchasePlan` 的 `const rc = await getPurchases(); if (!rc) return demoIapEnabled();` → `EXPO_PUBLIC_DEMO_IAP` 未设 → **返回 false**
5. 弹层显示「购买未完成。请检查网络或 App Store 付款设置后重试。」

**这不是网络问题，是纯竞态** —— 且恰好命中「App 启动后第一次打开付费弹层、尽快点购买」这一**审核员必然执行**的动作序列。

**修复**：把布尔量换成 Promise 缓存（只初始化一次，并发调用共享同一个 Promise）：
```ts
let loadPromise: Promise<any> | null = null;
function getPurchases(): Promise<any> {
  if (!loadPromise) loadPromise = (async () => { /* 原 import + configure 逻辑 */ })();
  return loadPromise;   // 并发调用拿到同一个 Promise，不再返回 null
}
```
（次要加固：`pro.tsx` 的买断按钮可加 `disabled={paying || !ready}`，但**仅靠 UI 约束不足以消除竞态**，必须修 `getPurchases`。）

---

## 3. 🟠 P1 —— 真实缺陷 / 架构不一致

### P1-1 **6 / 7 个弹层是「条件渲染 + visible 恒真」，完全绕过 Sheet 的退场保护**

**位置**：`ModalHost.tsx:56,101,121`（`<Sheet visible …>`）+ `ExportSheet.tsx:40,74`、`HabitForm.tsx:36,44`、`HonorForm.tsx:24,32`

以 ExportSheet 为例：

```tsx
if (!exportVisible) return null;          // ← 关闭时组件直接卸载
…
<Sheet visible={exportVisible} …>          // ← 因此这里恒为 true
```

**推论**：这 6 个弹层的「关闭」= **组件卸载**，所以 `Sheet.tsx:100-116` 那整段退场兜底逻辑

```tsx
const t = setTimeout(() => { setMounted(false); releaseSheet(tokenRef.current); … }, dOut + 120);
```

**永远不会执行**。后果：

1. **没有退场动画** —— 这 6 个弹层都是「啪」地消失；只有 `pro.tsx`（真正的 `visible` 驱动）有 250ms 淡出 → **同一种弹层体验不一致**，用户能感知。
2. **注释与事实不符** —— `Sheet.tsx:100-106` 用一大段「血泪注释」讲退场兜底如何防止「页面失去响应」，但实际只保护了 1/7 个实例。这会误导后续维护者以为「改 `visible` 就能控制动画」。

**修复方向**（择一）：
- 让 6 个弹层的关闭改为「先置 visible=false、由 Sheet 播完退场再交给父组件卸载」（统一语义）；或
- 明确接受「卸载式关闭」，在 `Sheet.tsx` 注释中标注「退场分支仅适用于非条件渲染用法」，避免误导。

---

### P1-2 `sheetArbiter` 在它**自称要解决的两个场景**里事实上不生效

**位置**：`src/lib/sheetArbiter.ts:11-13`

```ts
* 本项目的「链式弹层」正好会踩到：
*   · 习惯编辑弹层 → 删除确认（ConfirmDialog）
*   · 习惯编辑弹层 → 7 天补录（Backfill）
* 前者的退场动画要 270ms…
```

**但实测调用链是**：

```tsx
// HabitForm.tsx:162
onPress={() => { const id = editingHabitId; closeHabitForm(); askDelete("habit", id); }}
```

`closeHabitForm()` 让 HabitForm 卸载（见 P1-1）→ `Sheet` 卸载 → **unmount cleanup 同步 `releaseSheet()`**（`Sheet.tsx:77`）→ React 在 commit 阶段**先跑所有 cleanup、再跑新挂载组件的 effect** → ConfirmDialog 的 `claimSheet()` 读到的 `alive.size` 恒为 **0** → `others > 0` 分支**不进入**。

**结论**：`others > 0` 的「延后一帧」只在 `pro.tsx`（`visible` 驱动、release 延后 270ms）成立。`sheetArbiter.ts` 注释宣称「原生 present/dismiss 的顺序不再靠运气」——**在它列举的两个主要场景里并不成立**，实际仍依赖 React 两次 commit 之间的时间差。

（补充：这是**注释夸大**而非功能错误 —— 当前时序下两个原生 Modal 实际并存的概率低，但「确定性保证」的说法不成立。）

---

### P1-3 **诊断面板没有落地** —— 采集了，但屏幕上/Release 包里看不到

**位置**：`src/lib/payTrace.ts:14-16` 注释宣称

```
*   2. **常显在弹层内部**：面板渲染在支付步骤的底部（弹层内部）
*   3. **一键复制**：结果能直接粘出来
```

**实测消费者统计**：

| 导出物 | 引用数（排除自身） |
|---|---|
| `trace` | 16 |
| `useTrace` | **0** |
| `traceDump` | **0** |
| `clearTrace` | **0** |
| `PAY_TRACE_ON` | **0** |

`pro.tsx` 里**没有任何组件渲染 trace 面板**。

**后果**：即便带 `EXPO_PUBLIC_PAY_TRACE=1` 打出诊断包，数据只进内存缓冲，唯一出口是 `console.log` —— 而**真机 Release 包没有 console**（这正是该模块存在的理由）。**诊断能力目前等于零产出。**

**修复**：要么在 `pro.tsx` 的 Sheet 内挂一个 `useTrace()` 面板 + 复制按钮；要么明确标注「面板为下一阶段交付，本模块当前仅供 dev console」。

---

### P1-4 「顶部彩纸撒花」**永久失效**

**位置**：
- `src/store/app.tsx:226`：`const [celVisible] = useState(false);` ← **没有 setter，永远 false**
- `src/components/Confetti.tsx:154`：`if (!celVisible) return;` ← 撒花 effect 的守卫

**后果**：`Confetti.tsx` 的两条动效里，**「全完成时自屏幕顶部撒下 60 个彩纸/emoji」（文件头注释 §2、设计文档 M7）永不触发**；粒子爆裂（`burst`）走另一条 effect，**正常**。

**修复**：接入真实触发条件（如「今日全部习惯已打卡」派生），或删除该分支并同步删除设计文档中的承诺。

---

### P1-5 `purchasePlan` 把「用户主动取消」当成「真失败」

**位置**：`src/lib/iap.ts:147-149`

```ts
} catch {
  return false; // 用户取消 / 失败均视为未成功
}
```

**对比**：`restorePurchases`（`iap.ts:153-168`）**已经**做了 `none | error | timeout` 分级，并因此让弹层能分级措辞（`usePro.ts:106-108`）。

`purchasePlan` 返回纯 `boolean` → 用户**主动取消购买**也会走到 `dict.payBuyFail`：「购买未完成。请检查网络或 App Store 付款设置后重试。」——**把用户自己的操作归因成他的网络/付款设置有问题**。

**修复**：让 `purchasePlan` 返回 `{ok, reason}`（复用 `RestoreResult` 的形状），取消时静默或给中性文案。

---

### P1-6 `purchasePlan` 的 `hasNonSubscription` 是**过宽的成功判定**

**位置**：`src/lib/iap.ts:144`

```ts
const hasNonSubscription = Object.keys(customerInfo?.nonSubscriptionTransactions || {}).length > 0;
…
return hasEntitlement || hasNonSubscription || hasAllPurchased;
```

只要账户里存在**任意**非订阅交易就判为「本次买断成功」。这与上一轮专门删掉 `all[0]` 兜底时立下的原则 ——「只认本 App 自己的商品 ID，绝不用兜底，否则会把钱花到用户没选的东西上」—— **是同一类风险**，且 `restorePurchases` 里没有这一条（更严谨）。

当前只挂 1 个商品，实际风险低；**一旦后台新增第二个非消耗型商品，即成真缺陷**。

**修复**：删掉 `hasNonSubscription`，只保留 `ent[seeora_pro]` 与 `allPurchasedProductIdentifiers.includes("seeora_pro_lifetime")`。

---

### P1-7 支付 / 恢复**进行中**，✕ 与系统返回键仍可关闭弹层

**位置**：`src/app/pro.tsx:141`

```tsx
backdropClosable={!paying && !restoring}   // 只约束了「点遮罩」
```

但 `SheetHeader` 的 ✕（`pro.tsx:144`）与 `Modal` 的 `onRequestClose`（`Sheet.tsx:136`）**不受任何 busy 约束**。
→ 支付中关掉弹层，若随后失败 → `setPayErr(...)` 写入已关闭的弹层 → **下次打开看到陈旧错误（与 P0-2 叠加放大）**。

**修复**：`onClose` 内加守卫（`if (paying || restoring) return;`），或在 `SheetHeader` 传 `disabled`。

---

### P1-8 失败提示**在同一弹层内出现两次**

**位置**：`usePro.ts:74-79` 与 `pro.tsx:51-52`

```ts
// usePro.ts：既 showToast，又回传
if (!ok) { const text = dict.payBuyFail; showToast(text, false, 4200); return text; }
```
```tsx
// pro.tsx：拿到回传后再内联渲染同一句话
if (fail) setPayErr(fail);
```

而 `Sheet` 内部**同时挂载 `SheetToast`**（`Sheet.tsx:171`）→ 弹层开着时，**同一句「购买未完成…」在底部胶囊 + 按钮上方各出现一次**。`payRestore` 同理（`usePro.ts:110` + `pro.tsx:67`）。

注释（`usePro.ts:74`）写「既回传内联文案，也给全局 toast（弹层已关时仍能看到）」——是有意为之，但未意识到 `SheetToast` 让「全局 toast」在弹层内**也可见**，于是变成重复。

**修复**：二者只留一个 —— 建议保留内联（审核场景更稳），把该次 `showToast` 改为「仅在弹层已关时才发」。

---

### P1-9 `Sheet` 的仲裁 token 泄漏（270ms 内 关→开）

**位置**：`Sheet.tsx:107-118`

```tsx
const t = setTimeout(() => {
  setMounted(false);
  releaseSheet(tokenRef.current);   // ← 唯一的 release 点
  tokenRef.current = 0;
}, dOut + 120);
Animated.timing(anim, …).start();
return () => clearTimeout(t);        // ← cleanup 只清定时器，不 release
```

**泄漏路径**：`visible` true → false →（<270ms）→ true

1. false 的 effect 挂上 270ms 定时器
2. 定时器未到时 `visible` 又变 true → **先跑 cleanup（`clearTimeout`）** → `releaseSheet` 那个定时器被取消 → **旧 token 永不归还**
3. true 分支 `claimSheet()` 拿到新 token 并**立刻覆盖** `tokenRef.current` → 旧 token 从此无引用，`alive` 集合里**永久残留**

**后果**：此后每次打开弹层，`claimSheet()` 都会看到 `others ≥ 1` → **每次都多走一次「延后一帧」**；`alive` 集合只增不减（内存极小，但语义已脏）。
触发条件是「误触关闭后立刻重开」，**不罕见**。

**修复**：cleanup 里一并归还：
```tsx
return () => { clearTimeout(t); if (tokenRef.current) { releaseSheet(tokenRef.current); tokenRef.current = 0; } };
```

---

## 4. 🟡 P2 —— 代码质量 / 可维护性

| 编号 | 位置 | 问题 |
|---|---|---|
| P2-1 | `useHabitActions.ts:300` | `showToast(dict.delete === "Delete" ? (zh?"已删除":"Deleted") : (zh?"已删除":"Deleted"))` —— **三元两个分支完全相同**，条件判断毫无意义；且硬编码中英文（i18n 里也没有 `deleted` 键） |
| P2-2 | `ModalHost.tsx:49,67` | `for(i=0;i<=7;i++)` + `locked = diff > 7` → `diff ∈ [0,7]` → **`locked` 恒为 false**，`Lock` 图标与 0.5 透明度为**死分支**（`d.backfillLocked` 在 ModalHost 内未被使用） |
| P2-3 | `i18n.ts` | **未被引用的键**：`wipeDone`、`payUnavailable`、`proRetry`、`proTrialOver`、`errGeneric`（`doWipe` 反而硬编码了与 `wipeDone` 一字不差的文案） |
| P2-4 | `Sheet.tsx:41` | `const { c, styles } = useStyles();` 中 `c` **未使用** |
| P2-5 | `ExportSheet.tsx:90` | `ExportBtn` 声明了 `dict` prop 却**未使用**（调用点仍传 `dict={d}`） |
| P2-6 | `useHabitActions.ts:36` | `showToast: (msg, ok?) => void` **未同步** `app.tsx:149` 新增的第三参 `ms` → 该 hook 内无法使用长文案时长 |
| P2-7 | `Sheet.tsx:153,182` | 遮罩 `accessibilityLabel="close"` 与 `SheetHeader` 默认值 `closeLabel = "close"` 仍是**裸英文**（所有调用点虽都传了 `closeLabel`，但默认值与遮罩仍会被 VoiceOver 读成英文） |
| P2-8 | `pro.tsx:169,192` | 内联错误用 `accessibilityLiveRegion="polite"` —— 项目自己在 `Toast.tsx:77-78` 注明「**iOS 上该属性本身不生效**」→ iOS 不播报；Android 会与 `ToastHost` 重复播报 |
| P2-9 | `pro.tsx:122` | 手写 `d.proTrialLeft.replace("{n}", …)`，未用项目自带 `fmt()`（`i18n.ts:221`） |
| P2-10 | `app.tsx:220,222` | `proVisible`、`shareVisible` **零消费者**（grep 仅命中定义处），却参与 `value` 的 `useMemo` 依赖 → 每次变化都让整个 App 的 context 失效重渲染；且 `openPro`/`gatePro` 都 `nav.push("/pro")` 无去重（连点可能叠路由，待真机确认） |
| P2-11 | `_layout.tsx:12,69` | `PortalHost` 已是**死挂载**（`ui/dialog.tsx` 零引用；popover/select/tooltip/dropdown/context-menu/menubar/hover-card/alert-dialog **业务引用全部为零**）→ 可移除 |
| P2-12 | `pro.tsx:203-212` | 恢复购买**成功**后弹层不自动关闭（仅 `setPurchased(true)` + toast）→ 用户需手动关；建议成功即 `closePay()` |
| P2-13 | `ExportSheet.tsx:46-48` | 混用 expo-file-system 新旧 API：`new File(Paths.cache, name)` 取 `file.uri` 后仍调旧式 `writeAsStringAsync(uri, …)`；建议统一为 `file.write(content)`（SDK 升级风险） |

---

## 5. 关于 5 条 `rn-pressable-style`（唯一被噪音淹没的真实 lint 问题）

**规则原文**（项目自定义，来自 devkit 的 oxlint 配置）：

> Function-style style on `<Pressable>` is not supported by NativeWind v4 — all styles will be **silently lost on Android**. Use className modifiers instead (e.g. `active:bg-blue-600`), or track pressed state with `useState`.

**命中 5 处**：

| 文件 | 行 | 后果 |
|---|---|---|
| `src/components/HabitRow.tsx` | 36 | 卡片 `backgroundColor` / `borderColor` / 按压缩放 `scale(0.95)` 丢失 |
| `src/app/habit/[id].tsx` | 160 | 打卡主按钮底色 / 描边 / 缩放丢失 |
| `src/app/habit/[id].tsx` | 234 | 成就卡片入口按钮同上 |
| `src/app/share.tsx` | 230, 245 | 保存 / 分享按钮同上 |

**三点必须说清楚**：
1. **不是本轮引入的** —— `share.tsx`、`habit/[id].tsx` 本轮未改动；`HabitRow.tsx` 本轮只改了 a11y label，这行 `style={({pressed}) => …}` 早于本轮。
2. **仅影响 Android** —— 目标平台是 iOS 海外 App Store，当前 iOS 不受影响（RN 原生支持函数式 style）。
3. 但 `HabitRow.tsx:36` 落在**本轮改过的文件**里，若决定修，本轮顺手修最省事。

---

## 6. 与上一轮结论的差异（诚实纠正）

| 上轮说法 | 本次实测 | 说明 |
|---|---|---|
| 「`tsc --noEmit` 0 错误」 | ✅ 成立 | 且 `.expo/types/router.d.ts` 存在 → 路由类型化**确实被校验** |
| 「`jest` 24/24」 | ✅ 成立 | — |
| （从未跑过 lint） | ❌ 真实基线：oxlint **120 errors**（115 配置噪音 + 5 真实）／biome lint 0／tsc 0 | **上一轮「验证通过」的口径缺了 lint 这一环**，本次补齐 |
| 「付款提示已修好（失败可见）」 | ⚠️ 部分成立 | 现在**能看到**了（SheetToast + 内联），但同一句话显示两遍（P1-8），且失败文案会跨弹层残留（P0-2） |
| 「`sheetArbiter` 保证同一时刻只有一个原生 Modal」 | ⚠️ 不成立于主要场景 | 见 P1-2 |

---

## 7. 建议动作顺序（都不含打包）

**第一批（付费正确性，必做）**
1. P0-3 修 `getPurchases` 竞态（**唯一会让「点买断必然失败」的问题**，也是审核员第一下就撞到的）
2. P0-1 `openPay()` → `openPro()`（1 行，恢复付费转化）
3. P0-2 关闭弹层即清 `payErr`/`restoreErr`（1 行 useEffect）
4. P1-6 删 `hasNonSubscription` 宽判定（与上轮 `all[0]` 同源，1 行）
5. P1-5 `purchasePlan` 返回 reason，取消不涂红

**第二批（弹层一致性 / 已知失效功能）**
6. P1-4 撒花接线（或明确删除承诺）
7. P1-9 `Sheet` 退场 cleanup 补 release（1 行）
8. P1-7 支付中禁 ✕
9. P1-8 去掉重复提示

**第三批（清理 / 文档诚实化）**
10. P1-1 与 P1-2 的**注释改写**（把「已保证」改成「仅覆盖 X 场景」）——成本极低，价值极高
11. P1-3 诊断面板：要么补上，要么改写注释
12. P2 批量清理（死键 / 死分支 / 死状态 / `PortalHost` / Biome × 5）

**不阻塞提审**：`biome check` 的 59 个 import 排序、`react-native-ui-datepicker` 死依赖、`Leaderboard.tsx`、`swipeBus.ts`、`ui/dialog.tsx`。

---

## 附：本次审计使用的可复现命令

```bash
cd D:/Desktop/习惯927/native

# 类型
./node_modules/.bin/tsc --noEmit                                    # → 0 错误

# 测试
./node_modules/.bin/jest                                            # → 24/24

# lint（runner 等价命令，因为 npm run lint 在本机 EBUSY）
DK=node_modules/miaoda-expo-devkit
./node_modules/.bin/biome lint --config-path "$DK/biome-config.json" .
./node_modules/.bin/oxlint --config "$DK/oxlint-config.json" \
  --ignore-pattern metro.config.js --ignore-pattern babel.config.js \
  --ignore-pattern .pnpmfile.cjs --ignore-pattern "output/**" \
  --ignore-pattern "supabase/**" --ignore-pattern "src/components/ui/**" \
  --ignore-pattern ".skills/**" .
```
