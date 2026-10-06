# Seeora App — 免费版 5 个习惯上限 · 升级引导修复说明

日期：2026-10-02
工程：`D:\Desktop\习惯927\native`
状态：**已改码并验证；未 git commit、未打包**（等明确命令）

---

## 一、你反馈的现象

> 免费版只能创建 5 个习惯，点击第六个习惯就是不能打开，它要触发那个升级专业版的按钮，给出引导，让他去付费。

现象确认成立，而且比"不能打开"更糟：**点第 6 个会正常展开添加表单，等你把标题填完、点保存，才被告知超限**——白做一遍，然后什么也没有。

---

## 二、根因（`useHabitActions.ts:213` 的旧代码）

```ts
if (!pro && habits.length >= FREE_HABIT_LIMIT) {
  openPay();                 // ← 错在这里
  showToast(lang === "zh" ? "免费版可创建 5 个习惯……" : "…");
  return;
}
```

`openPay` 的全部实现只有一句：

```ts
const openPay = useCallback(() => setPayVisible(true), [setPayVisible]);
```

它只把 `payVisible` 置为 `true`，**但 `payVisible` 唯一的消费者是 `/pro` 路由页内部的那个购买弹层**。用户从 Today 页触发时，`/pro` 页面根本没有挂载 → 没有任何组件在读这个状态 → **什么都不会出现**，屏幕上只剩一句 2.2 秒就消失的提示。

这与上一轮审计报告里的 P0-1 是同一处，本次一并根治。

---

## 三、产品意图本来就有标准答案：网页版原型是对的

网页版 `index.html:1980` 的写法：

```js
if (!isPro() && HABITS.length >= 5){ hideSheet("sheetAdd","maskAdd"); showPaywall("limit"); return; }
```

`hideSheet` 先关掉添加表单 → `showPaywall("limit")` 再打开付费墙，并且付费墙带专属文案
（`payLimitT:"免费版已达上限"` / `payLimitS:"最多 5 条习惯 · 升级解锁更多"`）。

**App 版没有对齐网页版**：既没关表单，也没打开付费墙，只用了一个无处渲染的 `payVisible`。
本次修复就是把 App 对齐到这个既有范式。

---

## 四、改了什么（7 个文件）

### 1. `src/app/today.tsx` —— 在**入口层**拦截（体验的关键）

新增：

```ts
const atLimit = !pro && habits.length >= FREE_HABIT_LIMIT;

const open = () => {
  if (atLimit) { openPro("habitLimit"); return; }   // 达上限 → 直接进买断页
  openHabitForm(null);
};
```

Today 页三个"添加习惯"入口（顶部 + 按钮、空态引导卡、底部常驻虚线行）**全部走这一个 `open`**，
所以一次改动即全部覆盖。达到上限后不再让用户白填表单。

底部虚线行同时切换为升级引导样式，让用户在**点击之前**就知道会去哪：

| | 未达上限 | 已达上限 |
|---|---|---|
| 图标 | `Plus` 灰色 | `Gem` 绿色 |
| 边框 | `line2` 虚线 | `accent` 绿色虚线 |
| 主文案 | 添加习惯 | 已达免费版上限 5 个习惯 |
| 副文案 | 例如：晨跑 · 阅读 · 冥想 | 买断终身版即可解除数量限制，习惯数量永久不限 |

### 2. `src/store/usePro.ts` —— `openPro` 支持「来源标记」

```ts
export type ProReason = "habitLimit" | "dataExport" | "shareTitle";

const openPro = useCallback((reason?: ProReason) => {
  if (purchased) { showToast(getDict(lang).proOwned); return; }
  const now = Date.now();
  if (now - lastOpenRef.current < 600) return;   // ★ 连点防抖
  lastOpenRef.current = now;
  setProVisible(true);
  nav.push(reason ? `/pro?from=${reason}` : "/pro");
}, [...]);
```

**为什么加防抖**：`router.push` 是"新增一层"语义，600ms 内连点两次会叠出两层 `/pro`，
用户要连按两次返回才回得到 Today。付费入口是高频误触点，必须挡住。

顺带把 `gatePro`（导出/分享门禁）也改为**复用 `openPro`**——原先它自己写了一遍
`setProVisible(true) + nav.push("/pro")`，两个入口各写一遍必然产生行为不一致。

### 3. `src/app/pro.tsx` —— 买断页顶部说明「你为什么被带到这里」

读 `?from=habitLimit`，命中且未买断时，在页面最上方渲染一条说明条：

> **已达免费版上限 5 个习惯**
> 买断终身版即可解除数量限制，习惯数量永久不限。

不加这条，用户从底部虚线行点进来只会看到一张泛泛的买断页，不知道自己为什么突然到了这里。

### 4. `src/store/useHabitActions.ts` —— 保存层的兜底防线

```ts
if (!pro && habits.length >= FREE_HABIT_LIMIT) {
  setHabitFormVisible(false);        // ★ 先关表单
  showToast(dict.habitLimitToast.replace("{n}", String(FREE_HABIT_LIMIT)), false, 2600);
  openPro("habitLimit");
  return;
}
```

- `openPay()` → `openPro("habitLimit")`：修掉"打开了不存在的东西"这个根因。
- **先关表单**：`HabitForm` 是原生 Modal，会整片盖住随后 push 上来的 `/pro` 页。
  （正常路径在 Today 入口就已被拦下，这里是兜底防线。）
- 文案从硬编码中英三元表达式改为走 i18n。

### 5. `src/lib/limits.ts`（新增）+ `src/lib/i18n.ts`

- `FREE_HABIT_LIMIT = 5` 单独成文件：该常量同时被「行为层」和「页面层」使用，
  放在 `useHabitActions` 里会让 `pro.tsx` / `today.tsx` 仅为取一个数字就拉入 `notify` / `haptic` 等运行时依赖。
  `useHabitActions` 保留 re-export 以兼容既有引用。
- i18n 三处（`Dict` 接口 / zh / en）同步新增 `habitLimitTitle` / `habitLimitBody` / `habitLimitToast`。
  文案中的上限数字用 **`{n}` 插值**而非写死 `5`，避免日后改常量却不改文案的漂移。

### 6. `src/store/app.tsx` —— 类型与装配

- `nav.push` 的入参由 `string` 改为 `Href`（类型化路由生效后，`router.push` 只接受已知路由字面量）。
- 传给 `useHabitActions` 的 `openPay` 换成 `openPro`。
- `openPro` 在 Context 中的签名同步为 `(reason?: ProReason) => void`。

### 7. `src/app/settings.tsx` —— 修掉我自己改动引入的隐患

```diff
- <BuyoutCard onPress={openPro} />
+ {/* openPro 现在接收 reason 参数，直接传引用会把点击事件对象当 reason */}
+ <BuyoutCard onPress={() => openPro()} />
```

`openPro` 原先无参，`onPress={openPro}` 无害；本次给它加上 `reason` 参数后，
按钮会把点击事件对象当 `reason` 传进去，URL 变成 `/pro?from=[object Object]`。
**这是改动引入的新风险，已在同一轮修掉。**

---

## 五、复核中额外抓到并修掉的问题

| # | 问题 | 性质 |
|---|---|---|
| 1 | `settings.tsx` 的 `onPress={openPro}` 会把事件对象当 `reason` | 本次改动引入，已修 |
| 2 | 买断成功后 /pro 顶部仍显示「已达免费版上限」，与下方「你已拥有永久版」自相矛盾 | 本次改动引入，已修（横幅条件叠加 `!purchased`） |
| 3 | 文案把上限数字写死为 `5`，与常量存在漂移风险 | 已修（改用 `{n}` 插值） |

---

## 六、验证结果

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ **0 错误** |
| `jest` | ✅ **24/24 通过** |
| `biome lint`（真实基线口径） | ✅ **0 错误** |
| `oxlint` | 120 errors，**与本轮改动前数量一致**（全是工具配置噪音：103 条测试文件缺 jest globals、12 条 `plugins/*.js` 缺 CommonJS `module`）；本轮改动的文件**无新增条目** |

**完整性检查（确认没有入口能绕过限制）**

| 检查 | 结果 |
|---|---|
| 所有 `openHabitForm(...)` 调用点 | 仅 2 处：`today.tsx`（新建，**已被 `atLimit` 拦截**）、`habit/[id].tsx`（编辑已有习惯，按设计不受上限约束） |
| `useHabitActions` 中 `openPay` 残留 | 仅注释中出现，代码路径已清零 |
| `FREE_HABIT_LIMIT` 引用点 | 4 处（常量定义 / 行为层校验 / 两个页面文案插值），口径统一 |
| 新 i18n 键 | `Dict` 接口 + zh + en 三处齐全（缺任一处 tsc 会直接报错） |

---

## 七、边界与已知未覆盖（如实声明）

1. **导入备份不受上限约束**：`importBackup` 直接写入习惯列表，不经过 `saveHabit` 的上限校验。
   若免费用户导入一个含 20 条习惯的备份，会得到 20 条。**这是原有设计（数据恢复性质），本轮未改**——
   是否要限制属产品决策，请一并确认。
2. **试用期语义**：`pro = purchased || 试用未过期`，所以 7 天试用期内可无限创建；
   试用到期后 `pro` 转 false，若已有 8 条习惯，**已有的不会删**，只是无法再新建——点添加即进引导页。符合既有设计。
3. **与网页版的权益口径差异（提请确认，非本次改动）**：网页版 FAQ 写「免费版可创建 5 条习惯，
   可使用打卡、补签、休息日、连续统计、热力图等**全部核心功能**，成就卡带一个淡淡的 Seeora 水印」；
   而 App 侧 `gatePro("dataExport" / "shareTitle")` 把**导出备份**与**分享成就卡**设为买断权益。
   两处对"免费版能做什么"的描述不一致，上架前建议统一口径。

---

## 八、真机必验（4 条）

1. **创建满 5 个后**，点底部虚线行 / 右上角 + → 应直接进入买断页，且页面顶部显示「已达免费版上限 5 个习惯」说明条。**不应**再展开添加表单。
2. 在买断页点关闭 → 应回到 Today，且返回后**不残留任何弹层**（页面可正常滚动、可点子项）。
3. 连点两次"添加习惯" → 应只进一层买断页，按一次返回即可回到 Today。
4. 走通买断（沙盒环境）→ 买断页应切到「你已拥有永久版」，**顶部说明条应消失**；回到 Today 后底部虚线行恢复为「添加习惯」，可继续创建第 6 个。

---

## 九、本轮状态

- **未 git commit、未打包**（按既定规则，等明确命令）。
- 本轮相对工作区新增/修改：`today.tsx`、`pro.tsx`、`settings.tsx`、`usePro.ts`、`useHabitActions.ts`、`app.tsx`、`i18n.ts`、`lib/limits.ts`（新增）。
- 零新增第三方依赖。
