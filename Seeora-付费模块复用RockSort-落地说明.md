# Seeora 付费模块：复用 RockSort 模式落地说明

日期：2026-10-02
来源工程：`D:\Desktop\922`（RockSort，已上架验证过的付费实现）
目标工程：`D:\Desktop\习惯927\native`（Seeora）
性质：**改代码**。未打包、未提交 git。

---

## 一、为什么复用（动机）

上一轮复核发现 Seeora 付费有一处结构性缺陷：

> Pay Sheet 用 `@/components/ui/dialog`（rn-primitives Dialog），
> 它在 iOS 上把遮罩包进 `react-native-screens` 的 **FullWindowOverlay → 独立 UIWindow**，
> 而全局 Toast 渲染在根层普通视图树（靠 `zIndex:999` 抬高）。
> **`zIndex` 不能跨 UIWindow** → 弹层开着时，Toast 必然被整片盖住。
> 叠加 `usePro` 失败路径**不关弹层** → 用户看到的现象仍是「点了买断没反应」。

RockSort 已经踩过同一个坑并留下了完整解法（其 `Sheet.tsx` / `Toast.tsx` 文件头注释
逐条写明了原理与禁令），因此本轮**直接复用其模式与代码**。

---

## 二、改了什么（8 个文件：3 新增 + 5 修改）

### 新增（自 `922` 移植，适配 Seeora 令牌）

| 文件 | 作用 |
|---|---|
| `src/lib/payTrace.ts` | **屏幕化分层诊断**。TestFlight/Release 包里没有 console，「点买断没反应」只能靠「哪一步没发生」定位。Push 式采集 + 一键复制全文。**仅 `EXPO_PUBLIC_PAY_TRACE=1` 的诊断包生效，正式包零成本短路** |
| `src/lib/useReduceMotion.ts` | 系统「减弱动态效果」实时跟随。**刻意不用 reanimated 的 `useReducedMotion`**（实测它只在模块加载时求值一次，用户运行期开关不生效） |
| `src/components/Sheet.tsx` | 自研弹层（RN 原生 Modal）。三条关键防线见下 |

**`Sheet.tsx` 的三条防线**（都来自 RockSort 的实测教训）：
1. **卸载由 `setTimeout` 兜底**，绝不只挂在动画完成回调上 —— 回调一旦不执行，
   Modal 会停在 `visible=true`，变成**看不见但全屏的触摸拦截层**（不能滚动、点不动、返回键失效）。
2. **`pointerEvents` 随 `visible` 收紧** —— 退场那几帧遮罩不再吃触摸。
3. **内嵌 `<SheetToast />`** —— 弹层内的提示必须在这里再渲染一份（理由见下）。

### 修改

| 文件 | 改动 |
|---|---|
| `src/components/Toast.tsx` | 新增 `SheetToast` 导出：**同一份 `toastMsg` 的第二处渲染**（弹层内）。另补 `announceForAccessibility`（VoiceOver 播报）、长文案限宽换行 |
| `src/store/app.tsx` | `showToast(msg, ok, ms?)` 支持自定义时长；`payDone/payRestore` 类型改为带返回值 |
| `src/store/usePro.ts` | `payDone` **返回失败文案** `string \| null`；`payRestore` 返回 `{ ok, failText, outcome }`；失败文案分类映射 + 给足阅读时长（4200/4600ms） |
| `src/app/pro.tsx` | **Dialog → Sheet**；失败原因**内联渲染在弹层内部**；按钮进行中换文案（`payProcessing/payRestoring`）+ `finally` 复位；恢复购买按 `outcome` **分级语气** |
| `src/lib/i18n.ts` | 新增 `payProcessing`（处理中…）、`payRestoring`（正在恢复…），中英三处同步 |

---

## 三、**没**复用的部分（重要，避免误搬）

RockSort 是**订阅制**（月/年/终身 + 介绍性优惠试用），Seeora 是**终身买断制**，
两者合规路径不同，以下内容**刻意未搬**：

| RockSort 有 | 未搬原因 |
|---|---|
| `@kit/iap` 共享包 | Seeora 工程**没有 `packages/` 目录**，无此依赖；Seeora 的 `src/lib/iap.ts` 是自包含实现，接口已够用 |
| 月付 / 年付档、`yearlySavePct`、套餐选择步骤 | Seeora 只有唯一商品 `seeora_pro_lifetime` |
| 试用天数披露行（`introDays` / `trialLine`） | 那是给**订阅型 App** 的 ASC 介绍性优惠披露（Guideline 3.1.2）。Seeora 是**非消耗型买断 + 本地 7 天试用**，属"非订阅型 App"，不适用 |
| 单弹层双步骤（`ProModal` 套餐→支付） | Seeora 的 `/pro` 是**路由页**（不是弹层），页内只有一层 Pay Sheet，**本就不存在嵌套 Modal**，无需改造 |
| `useRestoreAction` hook | 是 RockSort"订阅页内外两层入口共用"的产物；Seeora 只有一处恢复入口，逻辑直接落在 `pro.tsx` 更简单 |

---

## 四、验证结果

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | **0 错误** |
| `jest` | **24/24 通过** |
| 新增依赖 | **无**（三个新文件都是自包含，不引入任何 npm 包） |
| 打包 | **未打包**（等命令） |

---

## 五、⚠️ 同类问题遗留（本轮未动，需你定夺）

以下 4 个文件**仍在用同一套 rn-primitives Dialog**，弹层开着时提示同样会被 UIWindow 盖住：

| 文件 | 受影响的典型场景 |
|---|---|
| `src/components/ExportSheet.tsx` | **导入结果**（成功 / 格式错误 / 失败）—— 用户「导入完不知道结果」 |
| `src/components/ModalHost.tsx` | 确认类弹窗（删除、抹除数据）后的提示 |
| `src/components/HabitForm.tsx` | 习惯新建/编辑保存后的提示 |
| `src/components/HonorForm.tsx` | 荣誉保存后的提示 |

RockSort 的 `SheetToast` 注释里恰好点名了这几类（导入结果、保存结果、"这是 Pro 功能"）。
建议做法与付费同一套（换 `Sheet` 或至少补 `SheetToast`），但**本轮按你「付费最容易出问题」的指示范围先做付费**，
其余留作下一批，避免一次性改动面过大。

---

## 六、真机待验清单（离线已无法再推进）

1. 打开买断页 → 点「买断永久使用」→ 弹层内价格是否正常显示（`EXPO_PUBLIC_RC_IOS_KEY` 是否内联成功）。
2. **故意让购买失败**（沙盒账号取消 / 断网），确认失败文案**在弹层内部可见**。
3. 点「恢复购买」，确认「该账户没有可恢复的购买」是**中性色**（不是红色报警）。
4. 关闭弹层后立刻滑动/点按，确认页面跟手（验证 Sheet 卸载兜底）。
5. 需要排查时用诊断包：`EXPO_PUBLIC_PAY_TRACE=1` 构建，弹层内会显示 PAY-TRACE 面板，可一键复制全过程。

---

## 七、未做

- 未打包、未触发构建
- 未 `git commit`
- 未删除任何文件/依赖
- 未改 `eas.json`（`autoIncrement` 仍是 `true`）
