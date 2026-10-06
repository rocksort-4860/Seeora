# Seeora 弹层统一改造（4 处遗留）+ 豆包第二轮反馈复核

**日期**：2026-10-02
**代码快照**：`native/` 工作区（HEAD = `ce348a3`，本轮改动**未提交、未打包**）
**范围**：上一轮报告的 4 个「仍在用 rn-primitives Dialog」的文件，以及豆包第二轮反馈的逐条复核

---

## 一、这次干了什么（一句话）

**把全项目最后一个会「盖住提示」的弹层容器换掉了，并顺手修掉一个真会让两个原生 Modal 同时挂载的 bug。**

上一轮我只改了付费链路（`pro.tsx`），留了 4 个文件。这次全部做完，同时发现：**这 4 个文件里其实一共是 6 个弹层**（`ModalHost` 里还藏着 3 个）。

### 改动清单（8 个文件 + 2 个新增）

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/lib/sheetArbiter.ts` | **新增** | 单原生 Modal 仲裁器（见第三节） |
| `src/components/Sheet.tsx` | 修改 | 接入仲裁器；`SheetHeader` 增加 `closeLabel`（无障碍本地化）与 `icon` |
| `src/components/ExportSheet.tsx` | 重写容器 | Dialog → Sheet。**「导入完不知道结果」就是这里** |
| `src/components/HonorForm.tsx` | 重写容器 | Dialog → Sheet；顺手清掉标签硬编码 `#5B5E68` |
| `src/components/HabitForm.tsx` | 重写容器 | Dialog → Sheet；**修正删除按钮不关表单的 bug** |
| `src/components/ModalHost.tsx` | 重写容器 | 补录 / 删除确认 / 抹除确认 三个弹层 Dialog → Sheet |
| `src/app/pro.tsx` | 1 行 | 传 `closeLabel={d.close}` |
| `src/components/ui/dialog.tsx` | **未动** | 现已无人引用，成为死代码（见第六节） |

**零新增依赖**。`tsc --noEmit` **0 错误**，`jest` **24/24 通过**。

---

## 二、为什么这 4 处必须改（每一处都有真实可见的坏现象）

判断标准不是「它用了 Dialog」，而是**「弹层开着的时候，会不会有提示要显示」**。逐一核过源码：

| 弹层 | 弹层开着时发出的提示 | 用户实际看到的 |
|---|---|---|
| **ExportSheet** | `expFail`（导出失败）、`impFail`（导入失败）、`impOk/impEmpty/impFormat`（导入结果） | 「点了导出没反应」「导入完不知道成功没有」 |
| **HabitForm** | 「请输入标题」（空标题校验）、「习惯已添加/已更新」、免费版 5 个上限提示 | 「点了保存没反应」 |
| **HonorForm** | 「请输入标题」、「荣誉已添加/已更新」 | 同上 |
| **补录（Backfill）** | `backfillLocked`（单日锁定）、「已取消今日打卡」 | 点了没反应 |
| **删除确认** | 「已删除」 | 与关弹层同一批更新，被退场动画盖住 |
| **抹除确认** | 「已抹掉全部数据」 | 同上 |

`showToast` 的调用点在 `src/store/app.tsx`、`useHabitActions.ts` 里一共 **20 处**，其中**绝大多数发生在弹层开着的时候** —— 这就是为什么这一层不能只改付费那一个。

---

## 三、新增机制：`sheetArbiter`（**这一条不是 RockSort 的，是本项目新增**）

### 它解决的问题（真 bug，不是理论风险）

`HabitForm.tsx` 原来的删除按钮：

```tsx
// 改前：HabitForm 不关，直接开 ConfirmDialog
onPress={() => askDelete("habit", editingHabitId)}
```

`askDelete` 只做两件事：记下待删 id、把 `confirmVisible` 置 true。**它不会关闭 HabitForm。**

所以点「删除」的那一刻，`habitFormVisible === true` 且 `confirmVisible === true` —— 两个弹层**同时挂载**。改前用的是 rn-primitives Dialog（独立 UIWindow，靠 react-native-screens 管理，不是 VC present），两个窗口叠加还撑得住；**一旦换成 RN 原生 Modal，这就是教科书里的嵌套 Modal 场景**，会留下全屏透明 VC，表现正是「关掉之后整页点不动、不能滚动、返回键失效」。

同一文件上一行「补录打卡」按钮**本来就先 `closeHabitForm()`**，只有删除按钮漏了 —— 属于历史遗留的不一致。

### 修法

**A. 调用点先关再开**（`HabitForm.tsx`）：删除与补录都改成 `closeHabitForm()` → 再开下一个弹层。

**B. 但只改调用点还不够**：`Sheet` 的退场动画要 270ms（`duration.d1` 150 + 120 兜底），这 270ms 内旧 Modal **仍然存活**，依旧与新弹层重叠。于是新增仲裁器：

```
不变量：任意时刻最多只有一个 Sheet 的 <Modal> 处于挂载状态。

1. 新弹层 claimSheet() 抢到最新 token → announceSheet()
   → 其余弹层收到通知后【立刻】setMounted(false)（跳过退场动画，反正马上被新遮罩盖住）
2. claim 时若已有弹层存活（others > 0），新弹层把自己的 Modal【延后一个宏任务】挂载。
   React 被动 effect 引发的重渲染走微任务，必然先于 setTimeout(0) 的宏任务落地
   → 「旧 Modal 卸载」确定发生在「新 Modal 挂载」之前，原生 present/dismiss 不再靠运气。
   无并发弹层时（绝大多数情况）不延后，零额外延迟。
```

配套一处细节：`Sheet` 的 `mounted` 初值从 `visible` 改成 **`false`**。因为本工程多处弹层是「组件 return null 后挂载、visible 恒为 true」，初值取 `visible` 会让 Modal 在**首次 commit** 就挂上去，延后一帧就来不及生效。取 `false` 不引入视觉差异（`anim` 初值本来就是 0，首帧本来就看不见内容）。

### 为什么不做「单弹层双步骤」

RockSort 的 `PayStep.tsx` 用的是「单弹层双步骤」（同一个 Sheet 内换步骤），那是**更彻底**的解法。这里没采用的原因：删除动作走的是 store 的 `askDelete / doDelete`（`pendingDel` ref + `confirmVisible`），改成内联步骤要重写这条数据通路，改动面会从「1 个文件」扩散到「store + 2 个组件」。**仲裁器把风险收敛在一个文件里**，对「改完必真机验证」的当前阶段更可控。

> ⚠️ 仲裁器是**本项目首创**，RockSort 没有对应实现，也**没有真机验证过**。已在第七节列为必验项。

---

## 四、豆包第二轮反馈复核

| 豆包意见 | 裁定 | 说明 |
|---|---|---|
| **承认「进度过时」** | ✅ 成立 | 这次是**第二次**。上一轮我已实施「发现 A 的乙方案」，豆包仍在建议「选乙」。根因就是它说的 RockSort H3：外部复核必须对着写死 commit hash 的快照。 |
| **发现 A：建议选乙（内联文案、原地重试）** | ✅ 已落地，无需动作 | 上一轮已在 `pro.tsx` 实施：`payErr/restoreErr` 内联渲染在弹层内 + `usePro` 回传文案。本轮把同一套做法推广到其余 6 个弹层。 |
| **发现 B：建议保留 `autoIncrement: true`** | ⚠️ 与你的指令冲突，需你拍板 | 豆包的推理正确（本地写 1，EAS 构建时会自动 +1 产出 2）。但你说「要还原成 1」。**关键在于你想要的是「文件里写 1」还是「产物是 1」** —— 见第五节。 |
| **死依赖留到下版本** | ✅ 一致 | `react-native-ui-datepicker`、`Leaderboard.tsx`、`swipeBus.ts` 不卡提审。 |
| **打包等明确命令** | ✅ 一致 | 本轮**未打包、未提交**。 |

### 豆包漏掉的一点（本轮实测）

它反复强调「报告覆盖不到 Seeora 独有的新问题」，方向对，但**它自己也没覆盖到本轮这个**：`HabitForm` 删除按钮造成的**两个原生 Modal 同时挂载**。这条不在 RockSort 清册里，也不在它的两次反馈里 —— 是我把 4 个文件逐个读到底才撞到的。位置：`HabitForm.tsx` 删除按钮 + `useHabitActions.askDelete` 不关表单。

---

## 五、「buildNumber 还原成 1」这件事的真实状态

**已按你的指令执行**：`native/app.json` 的 `ios.buildNumber` `"2"` → `"1"`，工作区 diff 为空（与 HEAD 一致）。

但必须把一件事讲透，否则「还原成 1」的意图可能落空：

```
eas.json  →  appVersionSource: "local"  +  autoIncrement: true
```

含义：**EAS 在每次构建前会读本地 `app.json` 的 buildNumber，自动 +1 再写回。**
后果：本地现在写 `"1"`，**下次构建产出的包 buildNumber 仍然是 `"2"`**，并且会被写回 `app.json`（那个 `"2"` 很可能就是这么来的，不是手改）。

所以「还原成 1」有两种含义，请挑一个：

| 选项 | 做法 | 结果 |
|---|---|---|
| **甲：文件里写 1** | 保持现状 | `app.json` 显示 1；**下次构建产物号 = 2** |
| **乙：产物就是 1** | 再把 `eas.json` 的 `autoIncrement` 关掉 | 构建产物号 = 1；代价是以后每次提交都要手改 buildNumber |

**我的倾向是甲（保持 `autoIncrement: true`）**，理由与豆包一致：ASC 里 1.0.0 还没有任何 build，2 号直接可用，不影响提审；关掉之后每次构建都要手改号，反而更容易出错。**但 `eas.json` 属构建配置，我没有动，等你一句话。**

---

## 六、刻意**没**做

| 项 | 原因 |
|---|---|
| 删 `src/components/ui/dialog.tsx` | 已确认全局无人引用（只剩其他未被使用的 UI kit 文件互相引用 `native-only-animated-view`）。属死代码清理，和 `react-native-ui-datepicker` 一批留到下版本。 |
| 动 `eas.json` | 构建配置，见第五节，等你拍板。 |
| 摘崩溃诊断插件 / 升 reanimated | 与上轮一致：必须真机先验冷启动，崩了再升。**顺序不能反**（先摘补丁又崩 = 白干）。 |
| git 提交 | 按你的规矩，改完不自动提交。 |

### 一处需要你知道的 UI 变更（可回退）

改造前的 `DialogFooter` 在原生端是 **`flex-col-reverse`**（`sm:flex-row` 是 Web 断点，iPhone 上不生效）——也就是**按钮从 DOM 反着往上堆**，确认框里「保存」在「取消」上面。这明显是工具类在移动端没生效的产物，不是设计意图（同一行还写着 `flex-1`，那是横排等分才需要）。

我按它的原始意图改成了**横排**：取消在左、确认在右（Apple HIG 双按钮确认框的标准排布）。HabitForm 底部三按钮同理改为横排。

**如果你更想保留原来的堆叠样式，说一声，改回一行的事。**

---

## 七、真机必验清单（本轮新增 4 项，全部集中在弹层）

| # | 场景 | 预期 |
|---|---|---|
| 1 | 习惯详情 → 编辑 → 点「删除」 | 确认框正常弹出；确认后回到列表；**全程页面可滚动、按钮可点、返回键有效** |
| 2 | 习惯详情 → 编辑 → 点「补录打卡」 | 补录弹层正常打开、可勾选；关闭后页面跟手 |
| 3 | 关闭任意弹层后立刻再开另一个 | 不出现「整页失去响应」「点不动」 |
| 4 | 设置 → 导出备份 → 导入一个**故意损坏**的 JSON | **能看到失败提示**（这是本轮的核心修复点） |
| 5 | 深色模式下打开删除确认 / 抹除确认 | 正文、按钮、✕ 都清晰可读 |
| 6 | （上一轮遗留）故意让买断失败 | 弹层内联显示失败文案 |

**若 1–3 出现「关掉弹层后页面不响应」**，第一嫌疑就是仲裁器 —— 届时把 `src/lib/sheetArbiter.ts` 的两处开关（`others > 0` 延后、被顶替时立即卸载）临时关掉对比即可定位。

---

## 八、验证记录

```
$ ./node_modules/.bin/tsc --noEmit
（0 错误）

$ ./node_modules/.bin/jest
Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total

$ grep -rn "components/ui/dialog" src/
（无输出 —— 全项目已无 rn-primitives Dialog 引用）
```

**未打包、未提交 git。**
