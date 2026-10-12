# Seeora × DeepSeek 反馈复核报告

> 复核对象：DeepSeek 针对《Seeora-对照RockSort上架经验-核查报告》提出的 12 条新增/补查项 + 2 处结论修正
> 复核方式：**逐条回代码实测**（文件 + 行号），非推论
> 复核时间：2026-10-02
> 结论口径：**成立 / 不成立 / 部分成立（有真变体）/ 流程项（无需改码）**

---

## 一、总判定表（先看这张）

| # | DeepSeek 条目 | 我的复核判定 | 证据位置 |
|---|---|---|---|
| 🔴1 | C-04 toISOString 跨时区错一天 | **部分成立（发现真变体）** | `useHabitActions.ts:219` + `habitLogic.ts:116-124` |
| 🔴2 | E-07 nativewind 是构建硬依赖，不能删 | **完全成立（实锤）** | devkit `babel/preset.js:44,54`；`metro.js:63` |
| 🔴3 | B-04 弹层卸载需 timer 双保险 | **不成立（免疫）** | `ModalHost.tsx` 条件渲染 + `dialog.tsx` reanimated |
| 🔴4 | D-10 useReducedMotion 不实时生效 | **不成立（未使用）** | 全项目 grep 0 命中 |
| 🟡5 | D-06 左滑无 VoiceOver 等价入口 | **前提不成立，但暴露另一真问题** | 无左滑；`HabitRow.tsx:106` a11y label 硬编码英文 |
| 🟡6 | D-04 深色面星级/紧急色不达标 | **不成立（无此色阶）** | `tokens.ts:80-87` 深色已适配；无星级/优先级 UI |
| 🟡7 | E-08 删功能没连带摘引用 | **成立（有残留）** | `Leaderboard.tsx`、`swipeBus.ts`、i18n 文案键 |
| 🟡8 | E-09 expo export 改 tsconfig | **流程项**（本次未跑 export） | `tsconfig.json` extends devkit-base |
| 🟡9 | E-11 buildNumber 是本地计数器 | **需 ASC 侧对账** | `app.json:12` = `"2"` |
| 🟡10 | G-01 屏幕化分层诊断 | **部分具备（缺 press trace）** | `_layout.tsx:27-47,65-100` 已有 DIAG STAGE |
| 🟡11 | G-04/G-05 构建挂死识别 | **流程项**（无需改码） | — |
| 🟡12 | B-06 绝不给 toast 套 Modal | **不成立（没套）** | `Toast.tsx:25-35` 纯 Animated.View |

**另外，DeepSeek 对上一轮报告的两处修正，我全部采纳**（见第三节）。

---

## 二、逐条复核（含证据）

### 🔴1. C-04 toISOString 跨时区错一天 —— 部分成立（有真变体）

**DeepSeek 说**：「上轮写『无日期选择器→C 组免疫』不成立，日期序列化跟选择器无关。」

**复核结论：DeepSeek 的质疑方向正确，但 Seeora 的打卡日期本身有专门防线，真问题出在「习惯创建时间」。**

- ✅ **打卡日期免疫**：Seeora 有独立的 `src/lib/dates.ts`，第 2 行注释明确写着「**全部使用本地时区，禁止 toISOString 直接当日期用**」。核心函数 `fmtDate()`（第 9-11 行）用 `getFullYear/getMonth/getDate`，全是**本地时区**。所有打卡键（`checkIns[date]`）都走 `fmtDate()` → 打卡日期不会错一天。
- 🔴 **真变体（确认存在）**：
  - `src/store/useHabitActions.ts:219`：新建习惯写 `createdAt: new Date().toISOString()` ← **UTC 时间戳**
  - `src/lib/habitLogic.ts:116-124`：`habitStartDate()` 取 `createdAt` 的**前 10 字符当「习惯起始日」**
  - **后果**：北京时间 **00:00–07:59** 创建的习惯，UTC 日期还停在前一天 → 「起始日」记成昨天 → 影响节点数计算（frequency 节点）、累计曲线起点。
  - （本地 08:00 之后创建则正确，因为 UTC+8 已跨到同日。）
- `usePersist.ts:39` 的 `updatedAt: toISOString()` 仅元数据，**无害**。

**修法（1 行）**：`useHabitActions.ts:219` 改为 `createdAt: todayStr()`（`todayStr` 已在同文件被使用，见第 197-198 行）。

> 严重度校正：DeepSeek 说"打卡日期错一天 = 核心功能错"。实际是**「起始日」偏一天**（凌晨创建才触发），比它描述的轻，但确实是真 bug，属必修。

---

### 🔴2. E-07 nativewind 是构建链硬依赖 —— **完全成立（实锤）**

**DeepSeek 说**：nativewind/tailwindcss 业务 0 引用却是 babel preset + metro 硬依赖，删了 EAS 直接构建失败。

**复核结论：完全成立，且比它说的更彻底。证据如下：**

| 证据 | 位置 |
|---|---|
| babel preset 硬 require nativewind | `node_modules/miaoda-expo-devkit/dist/babel/preset.js:44` → `jsxImportSource: "nativewind"`；`:54` → `"nativewind/babel"` |
| metro 包装依赖 css-interop（nativewind 内核） | `dist/metro.js:63` → `require.resolve("react-native-css-interop/package.json")` |
| 项目走 devkit 包装 | `babel.config.js` 用 `miaoda-expo-devkit/babel-preset`；`metro.config.js` 用 `miaoda-expo-devkit/metro` |
| 依赖与配置齐全 | `package.json`：`nativewind ^4.2.3`、`tailwindcss ^3.4.17`、`react-native-css-interop 0.2.6`；`tailwind.config.js`、`nativewind-env.d.ts` 均在 |

**→ 我上一轮报告里把 `@rn-primitives/*` 写成「疑似死依赖」的表述必须降级。** DeepSeek 这条判断准确，采纳。

---

### 🔴3. B-04 弹层卸载双保险（timer 兜底）—— **不成立（Seeora 免疫）**

**DeepSeek 说**：系统开「减弱动态效果」时 durOut=0，动画回调拿不到 finished → Modal 常驻吃触摸。

**复核结论：架构不同，Seeora 不走「动画回调里 unmount」这条路。**

- **卸载由 React 状态驱动，不靠动画回调**：`ModalHost.tsx:38,94,118` 每个弹层都是 `if (!xxxVisible) return null;` —— 状态一关，组件直接不渲染。
- 弹层进场用 **reanimated** 的 `FadeIn/FadeOut`（`ui/dialog.tsx:8,40-41`），reanimated 对 reduce-motion 有内建处理，且 exiting 只影响视觉、**不阻塞卸载**。
- `Toast.tsx:26` 用 RN `Animated`，但带 `pointerEvents="none"` —— 即使动画回调不触发也**不吃触摸**，卸载由 store 的 `toastMsg` 控制（`Toast.tsx:23`）。
- RockSort 当年是「RN `Animated.timing(...).start(callback)` 在回调里 unmount」才有此坑，Seeora 无此写法。

---

### 🔴4. D-10 useReducedMotion 不实时生效 —— **不成立（未使用）**

全项目 grep `useReducedMotion|reduceMotion|isReduceMotionEnabled|AccessibilityInfo` = **0 命中**。
reanimated 仅用于 `Confetti.tsx`（庆祝彩带，装饰性）与 `src/components/ui/` 模板组件。**→ 无障碍验收不会因这个 hook 挂。**

---

### 🟡5. D-06 左滑编辑/删除无 VoiceOver 等价入口 —— **前提不成立，但暴露另一真问题**

- 全项目 grep `Swipeable|renderRightActions|accessibilityActions` = **0 命中** → **Seeora 根本没有左滑交互**。
- `src/lib/swipeBus.ts`（左滑互斥总线）是**零引用死代码**（详见 🟡7）。
- 删除入口在 `HabitForm.tsx:146`（编辑表单内的删除按钮）。
- **真问题（本次新发现）**：`HabitRow.tsx:106` 打卡圆钮 `accessibilityLabel={done ? "undo" : "check"}` —— **硬编码英文、语义模糊、未走 i18n**。VoiceOver 用户听到的是 "check"/"undo"，既不是母语也不是人话。
  **建议**：补 `d.checkToday` / `d.undoToday` 两个 i18n 键（如「今日打卡」/「取消打卡」）。

---

### 🟡6. D-04 深色面星级/紧急色 1.44/1.67:1 —— **不成立（无此色阶）**

- Seeora 状态语义 = 完成(绿) / 休息(灰) / 无记录(底色)，tokens 注释铁律写明「**不使用红色，不引入第二个强调色**」（`tokens.ts:5-6,37`）。
- **无星级、无优先级色阶 UI**（`HabitRow` 的连续天数用文字 `d.curStreak · N`，非色阶）。
- 深色令牌已为 `success/warn/danger` 单独适配（`tokens.ts:80-87`：`success #30D158`、`warn #FF9F0A`、`danger #FF453A`）。
- ⚠️ 注意：**我上一轮提的「深色 Toast 对比度 1.09:1」与 D-04 是两码事**，那条仍然成立（见第四节待修清单）。

---

### 🟡7. E-08 删功能没连带摘引用 —— **成立（有残留）**

| 残留物 | 状态 | 证据 |
|---|---|---|
| `src/components/Leaderboard.tsx` | **0 引用** | `history.tsx:66` 注释自认「v0.2 明确不做排行榜，原 Leaderboard 不再挂入（组件文件保留待删除）」 |
| `src/lib/swipeBus.ts` | **0 引用** | 仅自身定义（`setOpenSwipe/getOpenSwipe/onOpenSwipe`） |
| i18n 文案键 `leaderboard/sortDays/sortName/sortCreated` | **0 引用** | `i18n.ts:50,188` |
| `src/components/ui/` 下 40+ 模板组件 | **大多 0 引用** | 业务实际只 import `dialog/button/text/icon` 等少数 |

**路由侧无幽灵声明**：`src/app/index.tsx:27-38` 的 Tabs 只声明 `history/today/settings`（三文件均存在）；根 `_layout.tsx` 用 `Slot` 由文件系统驱动，无手写 `Stack.Screen` 幽灵项。

---

### 🟡8. E-09 expo export 副作用改 tsconfig.json —— **流程项**

本次**未跑 `expo export`**，无法实测。提示：`tsconfig.json` extends `miaoda-expo-devkit/tsconfig-base`，若日后跑 export，跑完务必 `git diff tsconfig.json` 检查是否被写入 `include/.expo/types` 之类，避免污染提交。

---

### 🟡9. E-11 buildNumber 是本地计数器 —— **需 ASC 侧对账**

- `app.json:12` → `"buildNumber": "2"`；`app.json:6` → `"version": "1.0.0"`
- 本地查不到 ASC 实际构建列表，**需你在 App Store Connect → TestFlight → 版本对账**，看是否已有占用 1、2。
- 同类不一致（我上轮已提）：`package.json:2-3` 的 `name: "expo-template"`、`version: 1.0.49` 与 `app.json` 的 `1.0.0` 不一致。

---

### 🟡10. G-01 屏幕化分层诊断 —— **部分具备（缺 press trace）**

- ✅ **已有**：`_layout.tsx:27-28` 的 `EXPO_PUBLIC_DIAG` + `EXPO_PUBLIC_DIAG_STAGE`，`DiagBadge`（第 35-47 行）在屏幕左上角显示 `DIAG STAGE n`；第 65-100 行按 STAGE 做**冷启动二分**（-1 裸屏 → ≥1 状态栏 → ≥3 手势 → ≥4 弹层）。
- ❌ **缺**：**press 事件流 trace** —— DeepSeek 说的最有价值判据「trace 里没有 press = 按钮被禁用或触摸被吃」在 Seeora **尚不存在**。
- 另：`withTurboModuleFix` 插件里有「写剪贴板」的一键复制能力（属崩溃诊断，非交互 trace）。

**→ Seeora 的诊断是「冷启动二分」，RockSort G-01 是「交互事件流」，两者互补不重复。**

---

### 🟡11. G-04/G-05 构建挂死识别 —— **流程项**

真实存在但属打包时的人工判据，无需改码。打包时留意即可。

---

### 🟡12. B-06 绝不给 toast 套 Modal —— **不成立（没套）**

`Toast.tsx:24-35`：`Animated.View` + `position:"absolute"` + `zIndex:999` + `pointerEvents="none"`，**未包裹任何 Modal**。✅ 无此反模式。

---

## 三、DeepSeek 对上一轮报告的两处修正 —— 我全部采纳

| DeepSeek 修正 | 我的裁定 |
|---|---|
| ①「C 组免疫」不成立：C-04 与选择器无关 | **采纳**。Seeora 打卡日期免疫，但 `createdAt` 当起始日存在 UTC 偏一天变体（🔴1） |
| ②「E-03 死依赖」要降级：0 引用 ≠ 可删 | **采纳**。nativewind 是 babel/metro 硬依赖（实锤）；`react-native-ui-datepicker` 虽 0 引用且 devkit 未 require，但**删除前必须整包验证** |

---

## 四、合并后的「真问题」清单（两轮报告去重后）

按对习惯打卡 App 的实际杀伤力排序：

| 优先级 | 问题 | 位置 | 修法 | 成本 |
|---|---|---|---|---|
| 🔴 P0 | **reanimated 4.2.1 + worklets 0.7.4 = RockSort 记录会崩的组合** | `package.json:74,80` | 先打 demo 包真机验冷启动；崩再升 `4.5.1 + 0.10.4` | 待验证 |
| 🔴 P0 | **诊断插件在生产包内**（写剪贴板/中文弹窗/写 Documents + `UIFileSharingEnabled:true`） | `app.json:16,75-77` | 提审前摘插件 + 关文件共享 | 改配置 |
| 🔴 P1 | **`createdAt` 用 UTC 当「起始日」**（凌晨创建偏一天） | `useHabitActions.ts:219` | 改 `todayStr()` | 1 行 |
| 🔴 P1 | **购买失败零反馈**（`if(!ok) return;`） | `usePro.ts:48` | 补失败提示 + 区分取消/网络 | 小 |
| 🔴 P1 | **恢复失败弹按钮文案**（`showToast(dict.proRestore)` = "恢复购买"） | `usePro.ts:63`；`i18n.ts:140,202` | 换 `payUnavailable` 类真实错误文案 + 分「没买过/网络」 | 小 |
| 🔴 P1 | **深色 Toast 不可见（1.09:1）** | `Toast.tsx:29`（`c.ink` 当背景/`c.inkInverse` 当字，深色下语义翻转） | 换不翻转的专用令牌 | 小 |
| 🟡 P2 | 残留死代码/死依赖（Leaderboard、swipeBus、i18n 键、ui-datepicker） | 见 🟡7 | 摘引用（**删依赖前先整包验证**） | 小 |
| 🟡 P2 | HabitRow 打卡钮 a11y label 硬编码英文 | `HabitRow.tsx:106` | 补 i18n 键 | 2 行 |
| 🟡 P2 | `iap.ts:137` 仍留 `|| all[0]` 回退 | `iap.ts:137` | 去掉回退，只认精确 ID | 1 行 |
| 🟡 P2 | `package.json` name/version 与 app.json 不一致 | `package.json:2-3` | 统一为 seeora / 1.0.0 | 小 |
| 🟡 P2 | 价格文本无 `numberOfLines` | `pro.tsx:90` | 加上防溢出 | 1 行 |

---

## 五、给 DeepSeek 的补充材料（文件包）

已整理至：`D:/Desktop/习惯927/给DeepSeek-复核文件包/`（共 25 个文件）

```
根配置（root-config/）
  app.json  package.json  babel.config.js  metro.config.js  tsconfig.json
路由（src/app/）
  _layout.tsx  index.tsx  pro.tsx  settings.tsx
核心库（src/lib/）
  iap.ts  dates.ts  habitLogic.ts  tokens.ts  appleDesign.ts  i18n.ts  swipeBus.ts
状态（src/store/）
  app.tsx  usePro.ts  usePersist.ts  useHabitActions.ts
组件（src/components/）
  Toast.tsx  ModalHost.tsx  HabitRow.tsx  HabitForm.tsx  dialog.tsx
```

其中 **`dates.ts`（C-04 日期防线）、`HabitRow.tsx`（列表项）、`babel.config.js`+`metro.config.js`（E-07 硬依赖）、`habitLogic.ts`（起始日计算）、`swipeBus.ts`（死代码证据）** 是 DeepSeek 本轮点名要的补件。

---

## 六、本次复核的性质声明

- **只读核验，未改任何代码**；未执行打包、未执行 `eas` 命令。
- 所有判定均给出**文件 + 行号**，可逐条回验。
- 打包将在收到明确指令后进行。
