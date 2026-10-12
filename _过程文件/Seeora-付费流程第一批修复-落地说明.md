# Seeora · 付费流程第一批修复 — 落地说明与豆包反馈复核

日期：2026-10-02
范围：`D:/Desktop/习惯927/native`（Expo SDK55 / RN 0.83.2）
状态：**已改代码，未打包、未 git commit**

---

## 一、一句话结论

豆包给的 5 条意见，**4 条采纳并已落地，1 条（P1-4 留真机）已采纳但换成更严格的做法**；
另有 1 条它说"1 行"的改动，**照原样做会造出比原 bug 更严重的拒审项**，我改成了不会踩坑的版本。

**并且在这轮复核中查出一处比豆包所指更严重的问题**（已发布的落地页承诺了一项 App 里根本不存在的功能）。

---

## 二、本轮落地清单（5 项，全部通过验证）

| # | 问题 | 改法 | 文件 |
|---|---|---|---|
| P0-1 | 冷启动后第一次点「买断」必然失败 | 幂等守卫 `boolean` → **Promise 缓存** | `lib/iap.ts` |
| P0-1b | （豆包第二条）价格未就绪时按钮不该可点 | `disabled` 增加 `!ready`，**并先保证 `ready` 会归位** | `lib/iap.ts` + `app/pro.tsx` |
| P0-2 | 失败文案跨次残留 | 弹层每次打开显式清空（原注释的前提是错的） | `app/pro.tsx` |
| P1-1 | 用户点「取消」被报成「检查网络」 | `purchasePlan` 返回三态，区分 `cancelled` | `lib/iap.ts` + `store/usePro.ts` |
| P1-2 | 支付/恢复进行中仍可关闭弹层 | ✕（`SheetHeader.closable`）+ 安卓返回键（`Sheet.onClose`）**两个入口分别拦** | `components/Sheet.tsx` + `app/pro.tsx` |
| P1-3 | 同一句失败提示在弹层内显示两遍（**采纳豆包"提到第一批"**） | 失败只走内联回传，删掉会重复的那条全局 toast | `store/usePro.ts` |

另有一处**主动加固**（不在豆包清单里）：`onPay` / `onRestore` 原先只有 `finally` 没有 `catch`
—— 一旦抛异常，按钮复位了但屏幕上一个字都没有，违反本项目「失败绝不静默」的铁律。已补 `catch`。

---

## 三、最值得说的一条：豆包那条「1 行」的改动，照做会引入更严重的拒审项

豆包建议买断按钮加 `disabled={paying || !ready}`，"两层一起做，1 行"。
方向对，但**直接写会出事**，原因在 `ready` 的语义：

```ts
// 改前 usePlanPrices：
const rc = await getPurchases();
if (!rc) return;                  // ← 无价格源（未配 key / web / 原生模块加载失败）
                                  //   ready 就**永远停在 false**
```

三条路径里有一条会让 `ready` **永不归位**——于是 `disabled={... || !ready}` 不是"临时置灰"，
而是**永久灰按钮**：看得见、永远点不动。这正是我自己那份技能里点名的反模式
（「付费按钮因数据未就绪被静默禁用」），比原来的竞态更严重（Guideline 2.1：功能不可用）。

所以正确的顺序是**先让 `ready` 保证归位，再加 `!ready` 条件**：

```ts
if (!rc) { if (on) setReady(true); return; }   // 无价格源也必须结束加载态
```

`ready` 从此只表达「加载中 vs 已结束」，「取到价没有」由 `prices` 表达。
三条路（取到价 / 超时失败 / 无价格源）都会置 `true`，不可能永久禁用。

**这一条与 RockSort 已验证实现一致**：RockSort 的 `blocked` 一旦为真，**必须**同时渲染一行可见原因
（`PayStep` 的 `blockedHint` / `PlansStep` 的 `priceLoading`），绝不做静默置灰。我按这个原则做的。

---

## 四、P1-2 的落实：✕ 和返回键是两个独立入口

豆包说"你打包前先看一眼 `Sheet.tsx:153` 的 ✕ 是不是 `SheetHeader` 内部渲染的"。
**核实结果：是**（现为 `Sheet.tsx:195-203`，在 `SheetHeader` 里，不在 `Sheet` 里）。
所以给它加了 `closable` prop：

```tsx
<SheetHeader title={d.payTitle} onClose={...} closeLabel={d.close} closable={!busy} />
```

`closable={false}` 时 ✕ **置灰保留占位**，不是隐藏：
隐藏会让标题横向位移（`justify-content: space-between`），而且下一个人很可能会把"看不见"读成"没这个功能"。

**同时**拦返回键 —— 这条豆包提到了但容易漏：`backdropClosable` 只管**遮罩点击**，
`onRequestClose`（安卓返回键）走的是 `onClose`，旧写法直接 `closePay()`。

> 附带说明：RockSort 的 `SheetHeader` **没有** `closable`，它的 ✕ 在支付中也没拦。
> 所以这一条是豆包自己推的改进，不是"复用 RockSort 现有模式"——方向对，我采纳了，但要说清来源。

---

## 五、P1-3 为什么该提前做（同意豆包）

`payDone` 失败时**同时**做了两件事：`showToast(text, false, 4200)` + `return text`（内联）。
而 `Sheet` 内部本来就内嵌 `<SheetToast />`（读同一份 `toastMsg`）→ 同一句话在一屏里出现两次：
弹层底部的胶囊 + 按钮上方的一行。用户会当成渲染 bug。

**修法选择**：保留内联、删掉 toast。理由：失败时弹层**不会关闭**，内联永远有地方显示，
而且它位置贴近操作、不自动消失（错误信息一闪而过等于没提示）。
`payRestore` 同样处理。

---

## 六、验证证据

```
tsc --noEmit                     → 0 错误
jest                             → 24/24 通过
biome lint（真实基线口径）        → 0 错误（Checked 80 files）
oxlint（runner 配置）             → 120 errors，与本轮改动前**完全一致**（全是工具配置噪音，改动文件无新增）
```

### 竞态不是推理出来的，是跑出来的

写了一个纯逻辑复现脚本（等价结构：守卫 + 异步加载），脚本路径
`C:\Users\Administrator\AppData\Local\Temp\seeora_iap_race_check.mjs`，实测输出：

```
=== 场景：冷启动后第一次点「买断」（价格仍在加载中）===
旧（boolean 守卫）   购买时拿到模块=false → 失败（提示「请检查网络」）    后续调用拿到模块=true
新（Promise 缓存）   购买时拿到模块=true  → 成功                        后续调用拿到模块=true

竞态存在性：旧实现并发调用拿到 null = true（真值应为 true）
竞态是否已修：新实现并发调用拿到模块 = true（真值应为 true）

=== ready 归位（买断按钮 disabled={... || !ready} 是否可能永久置灰）===
旧：无价格源时 ready=false → 按钮永久禁用 是（拒审项）
新：无价格源时 ready=true  → 按钮永久禁用 否

RESULT: PASS
```

要点：旧实现的 `null` 只在**并发调用**时出现，后续调用是正常的 ——
这正是它难被发现的原因，也正好是"打开买断页、尽快点购买"这条审核员标准动作。

---

## 七、🔴 新发现：比 FAQ 更严重的一处口径冲突（在**已发布**的落地页上）

豆包指出网页版 FAQ 与 App 权益口径冲突，建议改网页版。方向对，但它看到的只是**原型文件**
（`index.html`）里的 FAQ —— 而同样的承诺还写在**真正对外发布的落地页** `landing.html` 上：

```
landing.html:147  Turn your milestones into beautiful cards. Preview them for free
                  (with a faint watermark); saving and sharing are Pro features.
             148  把连续打卡的成果生成精美卡片。免费版可预览（带淡淡水印），保存与分享为专业版功能。

landing.html:180  Achievement card preview (watermarked)      ← 免费版权益列表
             181  成就卡预览（带水印）

landing.html:191  Watermark-free card save & share            ← 专业版权益列表
             192  无水印成就卡保存与分享
```

而 App 的真实行为（已逐行核实）：

| 事实 | 证据 |
|---|---|
| **全项目零水印代码** | `grep -rn "水印\|watermark" native/src/` → 无任何命中 |
| 免费用户**连分享页都进不去** | `store/app.tsx:330` `if (!gatePro("shareTitle")) return;` ← `openShare` 第一行就拦 |

也就是说，落地页承诺了**两个不存在的差异点**：

1. 「免费版可预览（带水印）」——App 里免费用户点分享直接被引导买断，**没有预览**；
2. 「无水印」被当成专业版卖点 —— 既然根本没有水印，这个卖点**不成立**，
   而且它隐含"免费版有水印"，反过来又加强了第 1 条的误解。

同类文案还有 4 处（原型 `index.html`）：
`:749` EN `Remove the watermark`、`:819` `无水印成就卡`、`:826` `去除水印`、
`:1618/1629` FAQ 中英、`:1790` "无限习惯 · 无水印分享 · 数据导出"。

> 关于严重性的判断：这属于**对外描述与产品实际不符**。
> 影响面取决于审核员看不看落地页 —— 落地页正是上架清单里的 Marketing URL，
> 而 FAQ 只在原型里。所以我把它标为"必须在上架前统一"，但不主张它是"立刻改否则拒审"。

### ✅ 已执行：甲（以 App 为准，改文案）— 2026-10-02 哥哥裁定后落地

哥哥裁定：**甲**。理由与既有决定一致（他先前已确认「App 侧把导出备份和分享成就卡设为买断权益是对的」）。
**执行内容：7 处文案，两个 HTML 文件，零代码改动、可回滚。**

| 文件 | 位置 | 改后 |
|---|---|---|
| `landing.html:147-148` | 成就卡功能介绍 | EN `Saving and sharing them are Pro features.` / ZH `成就卡的保存与分享为专业版功能。` |
| `landing.html:180-181` | 免费版权益列 | **整条删除**（免费版剩 3 条） |
| `landing.html:189-190` | 专业版权益列 | `Achievement card save & share` / `成就卡保存与分享`（去掉"无水印"） |
| `index.html:1618` | FAQ 中文 | `…等核心功能。导出备份与分享成就卡为专业版功能。` |
| `index.html:1629` | FAQ 英文 | `…are all included. Exporting backups and sharing achievement cards are Pro features.` |
| `index.html:749` | 分享门禁弹层 EN | `Share achievement cards / Save & share a card that's truly yours`（原 `Remove the watermark`） |
| `index.html:826` | 分享门禁弹层 ZH | `分享成就卡 / 保存并分享属于你自己的成就卡`（原 `去除水印`） |
| `index.html:742` | 付费墙第 2 条权益 EN | `Share achievement cards / Turn your streaks into a card you can save & share`（原 `Watermark-free cards`） |
| `index.html:819` | 付费墙第 2 条权益 ZH | `成就卡保存与分享 / 把每一段坚持变成可珍藏的卡片`（原 `无水印成就卡`） |
| `index.html:1790` | 首页升级卡副标题 | `无限习惯 · 成就卡分享 · 数据导出`（原 `无水印分享`） |

**校准证据**：
- `grep -c "水印" landing.html index.html` → **0 / 0**（改前 landing 3 处、index 4 处）；
- `<li>` 标签配平：`landing 14/14`、`index 7/7`（改前 landing 16/16，正好少 2 条 = 删掉的那一对）；
- 分享门禁文案的消费处 `index.html:1347` `PAY_COPY.share = ["payShareT","payShareS"]` —— 新文案在该上下文里读得通（付费墙弹出的"为什么被拦"）。

**未采纳的乙（记录备查）**：真实现「免费带水印预览」——
需放开免费用户分享页入口 + 新增水印渲染，属新增功能；且带水印卡片被分享出去对品牌未必有利。

---

## 八、豆包五条的逐条裁定

| 豆包意见 | 裁定 |
|---|---|
| 一、Promise 缓存要写清"失败也缓存" | ✅ 采纳。已在 `iap.ts` 写进注释，含"将来加重试必须显式 `loadPromise = null`"。 |
| 一（附）、买断按钮加 `disabled={paying \|\| !ready}` | ⚠️ **方向采纳，但原样写会出问题**（见第三节）。已改成"先保证 `ready` 归位，再加条件"。 |
| 二、P1-2 要分别拦返回键与 ✕；先看 ✕ 是否在 SheetHeader 内 | ✅ 采纳。已核实**在** `SheetHeader` 内，按建议给了 `closable` prop。 |
| 三、P1-4 留真机，且与 P1-9 一起做 | ✅ **同意，且理由比它写的更充分**（见第九节）。 |
| 四、P1-3 提到第一批 | ✅ 采纳并已落地（见第五节）。 |
| 五、产品两问：改网页版 FAQ；分享卡为硬拦截不要水印模式 | ✅ 同意结论，但**发现问题范围比它说的大**（见第七节）；文案改动**等你发话**，我没动 HTML。 |

---

## 九、未做项与理由（都不是遗漏）

### 1. P1-4（6 个弹层没有关闭动画）→ 留真机
豆包说"改成动画模式后这 6 个弹层会全部依赖仲裁器，而它现在带泄漏 bug"。这个耦合判断**成立**。
我进一步把泄漏的真实影响算清楚了：

`sheetArbiter` 的泄漏发生在「`visible` 在 270ms 退场期内又变回 `true`」这条路径上
（effect 重跑 → `clearTimeout` → 定时器里的 `releaseSheet` 永不执行 → `tokenRef` 随即被下一次
`claimSheet()` 覆盖 → 该代号**永久**留在存活集合里）。

**影响有多大**：`announceSheet()` 广播的是**全局最新 seq**（不是存活集合最大值），
所以泄漏**不会**让新弹层误判自己被顶替。唯一后果是 `others > 0` 恒成立 →
此后每次开弹层都多延后**一个宏任务**（亚帧级，肉眼不可见）+ 集合缓慢增长（内存可忽略）。

**为什么现在仍然不修**：修法是把 `releaseSheet` 补进 effect 的 cleanup，
而那正好动在「任意时刻最多一个原生 Modal」这条不变量的关键路径上。
改错的后果是**两个 Modal 并存 → 关掉后整页失去响应**；不改的后果是"多延后一帧"。
两者代价完全不对称，而这条路径**离线无法验证**（要真机看原生 present/dismiss 顺序）。
→ 与 P1-4 一起，留真机阶段一起改、一起验。

### 2. `autoIncrement`（产物号）→ 保持现状，等你打包时顺口定
`eas.json` 是 `appVersionSource:"local"` + `autoIncrement:true`：本地写 `"1"`，**下次构建产出的包仍是 `"2"`**。
ASC 里 1.0.0 还没有任何 build，2 号直接可用，不影响提审。**未改 `eas.json`**。

### 3. 死依赖、`ui/dialog.tsx` 死代码 → 下版本（与豆包一致）

---

## 十、真机必验清单（打包后）

1. 打开买断页**立刻**点「买断永久使用」—— 应正常拉起 StoreKit，**不再**出现「检查网络」。（P0-1）
2. 在 StoreKit 面板点**取消** —— 应**没有任何**错误文案。（P1-1）
3. 故意让购买失败（断网）→ 关弹层 → 重开 → **不应**残留上次的失败文案。（P0-2）
4. 故意让购买失败 → 检查同一句提示**只出现一次**。（P1-3）
5. 支付进行中点 ✕ 与安卓返回键 —— 应均无反应，且 ✕ 呈灰态。（P1-2）
6. 恢复购买成功后 —— 弹层应自动关闭，页面显示「你已拥有永久版」。
7. 价格未取到时（飞行模式冷启动）—— 按钮应灰、且**不是永久灰**（约 8 秒超时后应恢复可点）。

---

## 十一、附：一处顺带观察（不是缺陷）

`landing.html:195-196`「7 天免费试用，到期自动回退」写在**专业版权益列表**里。
Seeora 是**一次性买断 + 本地试用**，不涉及扣款、也不需要 App Store Connect 配介绍性优惠，
所以不构成"误导扣费"。但它读起来像"买断包含 7 天试用"——
如果审核员据此去后台找介绍性优惠、发现没有，可能会多问一句。
风险不高，属可选项：若要更稳，可改成"免费版可先用 7 天专业版功能"这类**产品描述**而非"试用"措辞。
未改动，供你判断。
