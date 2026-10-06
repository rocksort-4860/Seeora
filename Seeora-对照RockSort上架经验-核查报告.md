# Seeora × RockSort 上架经验对照核查报告

> 核查对象：`D:\Desktop\习惯927\native`（Expo SDK 55 + RN 0.83.2 + expo-router，买断制 $4.99）
> 对照基准：`RockSort-上架总纲-问题台账与可复用防线.md`（清册 55 条 + A–H 八组防线）
> 核查时间：2026-10-02　|　方式：逐文件回代码实测（含 `tsc`、`jest`、`git check-ignore`、对比度公式复算）
> 图例：✅ 已达标 ｜ 🟡 需注意 ｜ 🔴 风险（建议动手）｜ 💭 不适用/认知类

---

## 〇、结论摘要（先看这段）

Seeora 的**代码质量底子比 RockSort 上架时好**：字号/类型检查、图标、i18n、`.gitignore`、真实网址、内购环境变量等 RockSort 踩过的基础坑，Seeora 基本都躲过了。
但有 **4 类 RockSort 记录在案、且 Seeora 当前确实存在** 的风险，按严重度排序：

| # | 风险 | 对应 RockSort | 严重度 |
|---|---|---|---|
| 1 | **reanimated 4.2.1 + worklets 0.7.4** —— 正是 RockSort 实测「编译过、冷启动仍崩」的组合，现靠 `turboModuleFix` 补丁兜底，未真机验证 | F-01 / F-04 | 🔴 |
| 2 | **诊断补丁仍在生产包**：`withTurboModuleFix` 会写剪贴板 + 弹中文「启动诊断」弹窗；`withCrashReason` 写 `crash_reason.txt`；且 `UIFileSharingEnabled:true` 让 Documents 对用户可见 | E-01 / D1 | 🔴 |
| 3 | **内购：购买失败静默无提示**；**恢复购买失败显示的是按钮文案**（不是错误文案） | A-06 / A-05 | 🔴 |
| 4 | **深色模式**：普通 Toast 文字与背景几乎同色（1.09:1 ≈ 不可见）；强调色上的白字仅 2.53:1 | D-01 / D-03 | 🔴 |

外加 5 项 🟡（弹层遮 Toast、`all[0]` 回退、死依赖、`package.json` name、价格未锁行）。

---

## 一、逐组对照（对照 RockSort 清册/防线）

### A 组 · 内购、订阅、权益

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| A-01 环境变量转发写法致公钥恒空 | 全部**字面读** `process.env.EXPO_PUBLIC_*`（`iap.ts:19-20,30`、`_layout.tsx:27-28`），无 `const env=process.env` | ✅ |
| A-02 `as{}` 遮住 SDK 字段名 / 无编译期护栏 | `iap.ts` 用 `let Purchases:any` 全程 `any` 读 `.product.priceString`、`.entitlements.active` 等，**无 `Assert<>` 护栏**（单商品风险较低，但零守卫） | 🟡 |
| A-03 订阅到期不失效（真金白银洞） | **不适用**：Seeora 是终身买断非订阅。且本地 7 天试用**有到期判断**（`app.tsx:194` `pro = purchased || Date.now()<trialUntil`） | 💭 |
| A-04 匹配失败回退 `all[0]` | **仍存在**：`iap.ts:137` `) \|\| all[0];`（单商品下危害小，但与 RockSort 结论相悖，建议删） | 🟡 |
| A-05 恢复购买不分「没买过/网络/过期」 | **失败时 `showToast(dict.proRestore)`** —— `proRestore` 是**按钮文案**（"恢复购买"/"Restore purchase"），不是错误提示；且不区分失败原因 | 🔴 |
| A-06 支付失败静默 `return false` | **确认存在**：`usePro.ts:47-48` `const ok=await purchasePlan(); if(!ok) return;` —— 失败**零提示**；`iap.ts:146` catch 直接 `return false` | 🔴 |
| A-07 断网时按钮变灰 | pro 页按钮始终可点（无静默禁用）；`priceLabel` 无价时回占位符 | ✅ |
| A-08 原生库未注册致崩溃 | 未用 media-library；`expo-image-picker`/`expo-sharing`/`expo-notifications` 均已在 `app.json` 注册且带双语权限文案 | ✅ |
| A-10 小屏买不了 Pro | `/pro` 页整体 `ScrollView`；Pay Sheet 为 Dialog | ✅ |
| A-12 价格运行时拉取 | `usePlanPrices` 运行时读 RC，代码零硬编码价格 | ✅ |

### B 组 · 弹层与触摸

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| B-01 嵌套原生 Modal → 关弹层后整页点不动 | **结构上未发现嵌套 RN `<Modal>`**：全部弹层走 `@rn-primitives/dialog` + `react-native-screens` 的 `FullWindowOverlay`（非 RN Modal；`node_modules/@rn-primitives/dialog` 内无 Modal）。但 `/pro` 是 modal 路由内再开 Dialog，**需真机验证关弹层后可交互** | 🟡 |
| B-02 弹层内的提示被盖住 | **存在**：`ToastHost` 是根窗口普通 absolute View（`zIndex:999`）；Dialog 渲染在**独立 UIWindow**（FullWindowOverlay）→ 弹层打开时 Toast 被盖。无 RockSort 的「同源双渲染 SheetToast」方案。受影响：`payRestore` 失败提示、`gatePro`（提示后立刻开 Pro 弹层，必被自己盖住） | 🟡 |
| B-03 静默禁用按钮（灰着不说话） | 补录页锁定行有 `Lock` 图标 + opacity，有可见原因 | ✅ |
| B-05 弹层内容不可滚 | Dialog 内容 + `/pro` 页均可滚 | ✅ |

### C 组 · 选择器

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| C1–C4 日历裁切 / 滚筒高度 / 选不到今天 / `toISOString` | Seeora **无日期/时间选择器**，源码零引用日期选择器 | 💭 |

### D 组 · 无障碍、视觉与文案

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| D-01/D-02 对比度不达 AA | **浅色 ✅**（白字 on `#2d7a6b` = **5.11:1**）；**深色 ❌**：白字 on `#4fb3a1` = **2.53:1**（不达 AA）——影响深色模式主按钮（买断按钮等） | 🔴 |
| D-03 浅/深色切换致元素不可见 | **深色 Toast 不可见**：`Toast.tsx:29` 用 `c.ink` 当**背景**、`c.inkInverse` 当文字 —— 深色下 `ink=#f5f5f7`（近白）+ 文字 `#ffffff` = **1.09:1** | 🔴 |
| D-05 多套冲突配色 | `tokens.ts` 为唯一真源，`appleDesign.ts` 为其上游，口径统一 | ✅ |
| D-07 i18n 完整性无校验 | `Dict` 接口 + `Record<Lang,Dict>` 由 **TS 编译期强制双语齐全**（缺 key 会 `tsc` 报错）；运行时无守卫测试 | ✅（附注） |
| D-08 动态长度文本折行 | 价格 `pro.tsx:90` `<Text text-[40px]>` **未加** `numberOfLines={1}` + `adjustsFontSizeToFit`（`$4.99` 影响小，但四位数价/系统字体放大有风险） | 🟡 |
| D-11 `package.json` name 仍是 `expo-template` | **仍是 `expo-template`**；且 version `1.0.49` 与 `app.json` `1.0.0` 不一致 | 🟡 |

### E 组 · 依赖、构建、上传层

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| E-01 调试诊断补丁进正式包 | **存在**：`app.json` plugins 仍挂 `crashReason` + `turboModuleFix`。前者写 `crash_reason.txt`+`NSUserDefaults`；后者在吞异常时**写剪贴板 + 弹中文「启动诊断(已复制到剪贴板)」**；叠加 `UIFileSharingEnabled:true`，Documents 内调试文件对用户可见 | 🔴 |
| E-03 死依赖（源码 0 引用） | `react-native-ui-datepicker@^3.3.0` 全项目 **0 引用**；另有一批 `@rn-primitives/*`（accordion/avatar/menubar/popover…）疑似未用（删前须按 E-10 查构建链） | 🟡 |
| E-05/E-06 `.gitignore` 未忽略 / 行尾注释失效 | **已达标**：`git check-ignore -v .env` → `native/.gitignore:35:.env` 生效；无行尾注释；无 `.easignore` | ✅ |
| E-08 删功能连摘引用 / 防复活 | — 未涉及 | 💭 |
| E-12 本地 `.env` 干净 ≠ 平台侧干净 | EAS 平台 production 环境已核对（含 RC 两个公钥 + 苹果三项；无诊断开关） | ✅ |
| E-15 EAS 以 `pnpm-lock.yaml` 为准 | lock 存在（535KB） | ✅ |
| E-16 不建 `.easignore` | 未建 | ✅ |

### F 组 · 冷启动与原生崩溃（★ RockSort 的主场）

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| **F-01/F-04 真凶：reanimated + worklets 版本** | **🔴 Seeora = `reanimated 4.2.1` + `worklets 0.7.4`** —— 正是 RockSort 版本矩阵里标注「**能编译、冷启动仍崩**」的组合；唯一验证「可编译 + 含 iOS 26 修复」的是 **`4.5.1 + 0.10.4`**。Seeora 目前靠 `withTurboModuleFix` 打补丁兜底（吞掉 NSException），**尚未真机验证冷启动** | 🔴 |
| F-04/F-06 冷启动 Unmatched Route 裸 scheme 防御 | **已达标 ✅**：`_layout.tsx:18-24` 已覆盖 `Linking.getInitialURL`，把裸 `seeora://` 中性化为 null（这正是 RockSort 缺的那段）；仅未覆盖 `getLinkingURL`（次要） | ✅ |
| F-06 启动期无条件兜底定时器 | `useHydration` 末行才 `setHydrated(true)`，**无超时兜底**；AsyncStorage 挂起则 `hydrated` 恒 false（不阻塞 Tabs 渲染，但 Onboarding 永不出现） | 🟡 |

### G 组 · 诊断与可观测

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| G-02 DIAG 二分（STAGE 0..5） | `_layout.tsx` + `usePersist.ts` 保留 `EXPO_PUBLIC_DIAG` / `STAGE` 开关，由环境变量门控；EAS 生产环境**未设** → 惰性无害。属临时诊断残留，可清可不 | 🟡 |
| G-03 打包档位分清 | `eas.json` 仅 `production` 一档（无 trace 档） | ✅ |
| G-06 诊断产物提审前删干净 | 同 E-01（诊断插件仍在） | 🔴 |

### H 组 · 流程与协作

| RockSort 条目 | Seeora 现状 | 判定 |
|---|---|---|
| H-01 未经许可不打包 | 本次严格遵守（等明确指令） | ✅ |
| H-04 提审顺序红线 | `ITSAppUsesNonExemptEncryption:false` 已声明 ✅；内购需**随版本一起提交**（ASC 网页操作，待办） | 🟡 |
| H-05 打包前零成本核对 | 已在执行（本报告即该项产物之一） | ✅ |

---

## 二、优先行动清单（建议顺序）

| 优先级 | 事项 | 依据 | 成本 |
|---|---|---|---|
| 🔴 1 | **真机验证冷启动**：按 F-01，`4.2.1+0.7.4` 在 iOS 26 有崩溃前科。先打 demo 包真机验证「能装、冷启动不崩、进得去首页」。**若崩 → 按 RockSort 矩阵升到 `reanimated 4.5.1` + `worklets 0.10.4`**（注意 devkit 锁 worklets，须查构建链、同步 lock） | F-01/F-04 | 中 |
| 🔴 2 | **摘诊断副作用**：从两个插件里**只去掉调试外泄部分**（剪贴板 / 中文弹窗 / 写 Documents 文件），保留必要的崩溃缓解；或将 `UIFileSharingEnabled` 关掉。提审前务必清（Guideline 2.3.1 风险） | E-01/D1 | 低 |
| 🔴 3 | **内购反馈补全**：① 购买失败给可见文案（禁止静默 `if(!ok)return`）；② 恢复购买失败改用真正的错误文案（`payUnavailable` 之类），并区分「没买过/已过期/网络」；③ 恢复成功/失败提示不要用按钮文案 | A-05/A-06 | 低 |
| 🔴 4 | **深色模式修色**：Toast 背景改用「不随主题翻转语义」的色（如固定深色胶囊）；深色模式强调色上的文字改深色（或加深绿），保证 ≥4.5:1 | D-01/D-03 | 低 |
| 🟡 5 | 弹层内提示：加「同源双渲染」（根 Toast + 弹层内 Toast），覆盖 gatePro/payRestore | B-02 | 低 |
| 🟡 6 | 删 `all[0]` 回退（`iap.ts:137`） | A-04 | 低 |
| 🟡 7 | 价格文本加 `numberOfLines={1}` + `adjustsFontSizeToFit` | D-08 | 低 |
| 🟡 8 | `package.json` name 改 `seeora`；对齐 version 与 `app.json` | D-11 | 低 |
| 🟡 9 | 清死依赖 `react-native-ui-datepicker`（删前按 E-10 查构建链） | E-03 | 低 |
| 💭 10 | （可选）补「守衙测试」：禁 `all[0]`、禁静默失败、i18n key 齐全、无 `const env=process.env` | 六章 T-0 | 中 |

---

## 三、Seeora 做得比 RockSort 好的地方（可直接沿用）

1. **Linking 裸 scheme 防御已在位**（`_layout.tsx`），RockSort 现役工程反而缺这段。
2. **`.gitignore` 合规**：`.env` 实测被忽略、无失效的行尾注释、未建 `.easignore` —— RockSort 这三条都翻过车。
3. **i18n 双语由 TypeScript 强制齐全**，天然规避「漏 key 渲染 undefined」。
4. **配色单真源**（tokens.ts），无 RockSort 的三套冲突配色。
5. **上传层干净**（无 `.ipa`/截图堆积），非 RockSort 的 42MB 问题。
6. 无日期/时间选择器 → 整组 C 类坑天然免疫。

---

## 四、需真机验证 / 待办（本报告无法离线坐实）

- [ ] iOS 26 真机**冷启动**是否崩溃（F-01 头号项）。
- [ ] 关闭 `/pro` 弹层后，底层页面**是否仍可滚动/点按**（B-01）。
- [ ] 弹层打开时 Toast **是否可见**（B-02）。
- [ ] ASC 提审时：内购 `seeora_pro_lifetime` **随版本提交**（H-04）。
