# 参考目录

> **最近整理：2026-10-12**（本文件逐条核对过，旧版有 6 处与实际不符，已修正）
> 从原工程（Streakora / `D:\Desktop\原工作流`）迁出的参考资料。
> **这里的文件都是历史参考，不是 Seeora 现役定稿。** 现役定稿在 `..\native\`（上架主体工程）与 `..\静态网页\`（营销/法务页）。

## 一、迁移文档（7 项）

| 文件 | 说明 | 状态 |
|---|---|---|
| `07-习惯算法规格.md` | **最重要**。能力清单 + 5 条核心规则（最长连续 / 连漏 2 天暂停 / 周期节点）+ 移植注意事项 | 仍是产品规则权威出处 |
| `01-产品规则-v0.2规格.md` | 休息日 / 补签 / 连续 / 周期节点的产品规则原文 | 有效 |
| `02-上架流程总手册.txt` | 上架 7 环节流程方法论 | 有效，跨四款复用 |
| `03-TestFlight真机测试指南.md` | 真机测试 SOP | **当前待办在用**（对应清单 1-B 第 4 条） |
| `04-APP开发工作流程.md` | 开发流程 | 有效 |
| `05-项目复工梳理报告.md` | 项目上下文 | 有效 |
| `09-Apple设计规范原型.html` | Apple 设计规范视觉参考（**仅看设计规范**，品牌与交互勿参考） | 有效 |

> 编号缺 06 与 08。**06 原是 PRD，与 `已删文件留档\工程参考\prd.md` 逐字节相同（md5 `01e65335…`），2026-10-12 删除了后者的重复副本，`06-RockSort-PRD历史参考.md` 保留在 `已删文件留档\`。**

## 二、源文件留档 ⚠️ 已与现役分叉，**不是现役逻辑**

| 文件 | 说明 |
|---|---|
| `_源-习惯算法.ts` | 原始算法文件（11,862 字节）。现役 `native\src\lib\habitLogic.ts` 已演进到 **16,559 字节**，两者**已分叉**。**读算法请读现役文件**，本文件只回答"当初是怎么设计的" |
| `_源-设计令牌.ts` | 原始设计令牌（7,056 字节）。现役 `native\src\lib\tokens.ts` 已到 **7,772 字节**，同样**已分叉** |

> 这两个文件**曾**与 `给DeepSeek-复核文件包`（已删）同属"长得像源码但不是源码"的类别。保留它们只为留存原始设计思路；若只要现役实现，直接看 `native\src\lib\`。

## 三、原生工程资产

| 文件 / 目录 | 说明 |
|---|---|
| `工程完整历史.bundle` | **原工程的完整 git 历史（唯一副本，绝对不能删）**，1.38 MB，2 个提交（`72d19b0` 初始 → `cf2ed8b` 冻结 0923 现状）。2026-10-12 已实测：`git bundle verify` 通过、可 `git clone` 整包还原。本仓库历史从 `c6e4de3 migrate` 才开始，**此前的一切只在这个 bundle 里** |
| `已删文件留档\` | 19 个「只存在于 git 里」的文件，已救出为普通文件（原 22 个，2026-10-12 删去 2 个日志与 1 个重复 PRD） |
| ~~`防崩溃三件套\`~~ | **已删除（2026-10-12）**。3 件中 `turboModuleFix` 与 `withFmtConstevalFix` 均比 `native\plugins\` 现役版本旧，且缺第 4 件 `withExpoModulesCoreWerrorFix`。旧副本易被误当基线，**现役以 `native\plugins\` 4 件为准** |
| ~~`_源-RevenueCat真实key留档.env.example`~~ | **已删除（2026-10-12）**。内含的 key 按 `参考\README` 旧版自述即「**Seeora 的旧 key，对 Seeora 无效**」，无对照价值；现行有效 key 在 `native\eas.json` 的 env 里。文件名"真实key留档"易误导人当成机密处理 |

### `已删文件留档\` 内容

```
06-RockSort-PRD历史参考.md       历史 PRD（原与 工程参考\prd.md 重复，保留此份）
HANDOFF.md                      交接说明
README-本地编译.md               真机本地编译说明
Streakora-dev-prompt.md         开发提示词（20 KB）
TestFlight_Build_Submit.bat     Windows 打包脚本（旧路线，已由 EAS 取代）
TestFlight打包提交.command       macOS 打包脚本（同上）
docs\Streakora-appicon.svg      品牌图标（应用图标版）
docs\Streakora-logo.svg         品牌图标
docs\Streakora-wordmark.svg     品牌字标
docs\streakora-prototype\       旧版原型（index.html 103 KB + 两个校验脚本）
src\components\WeekGrid.tsx     周视图组件
src\lib\habitLogic.test.ts      算法测试（已被 native\src\__tests__ 版取代）
工程参考\                        RockSort 工程参考 6 件（含 iOS26 启动修复终版配置）
```

> ~~`install.log` / `typecheck.log`~~ 已删（构建日志，无价值）。
> `TestFlight_Build_Submit.bat` / `TestFlight打包提交.command` 属旧打包路线，**已被 EAS 取代**，仅留作历史；照着跑不会再有产出。

## 四、原生工程本体

在 `..\native\`，**不在本目录**。迁移校验：113 个文件 `diff -r` 逐字节零差异；转 Seeora 必改项清单见 `native\README-迁移说明.md`。

## 五、用这份资料的方式

历史迁移结论见 `..\_过程文件\从原工程迁移与删除清单.md`（已从根目录归档）。
如果要把 07 号文件里的规则（最长连续、连漏 2 天暂停、周期节点）对齐进现役工程，
先对照 `native\src\lib\habitLogic.ts` 确认是否已实现——**多数已实现**；若确属缺口，
那是产品行为变更不是 bugfix，改之前要先定清楚要不要改。
