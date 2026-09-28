# 参考目录

从 `D:\Desktop\工作流0923`（原 Streakora 工程）迁出的参考资料。
**这里的文件都是历史参考，不是 Seeora 定稿。** Seeora 的定稿是根目录的 `index.html` 与四个静态页。

## 一、迁移文档（9 项）

| 文件 | 说明 |
|---|---|
| `07-习惯算法规格.md` | **最重要**。现 index.html 缺失的能力清单 + 5 条核心规则 + 移植注意事项 |
| `01-产品规则-v0.2规格.md` | 休息日 / 补签 / 连续 / 周期节点的产品规则原文 |
| `02-上架流程总手册.txt` | 上架 7 环节流程方法论 |
| `03-TestFlight真机测试指南.md` | 真机测试 SOP |
| `04-APP开发工作流程.md` | 开发流程 |
| `05-项目复工梳理报告.md` | 项目上下文 |
| `06-RockSort-PRD历史参考.md` | 历史 PRD |
| `09-Apple设计规范原型.html` | Apple 设计规范视觉参考（品牌为 Streakora，仅看设计规范） |
| `_源-习惯算法-Streakora.ts` | 原始算法文件留档 |
| `_源-设计令牌-Streakora.ts` | 原始设计令牌留档 |

## 二、原生工程资产（2026-09-28 新增）

| 文件 / 目录 | 说明 |
|---|---|
| `防崩溃三件套\` | crashReason / turboModuleFix / withFmtConstevalFix，**全网唯一副本，勿删**（另一份在 `native\plugins\`） |
| `_源-RevenueCat真实key留档.env.example` | **Streakora 的旧 key**，对 Seeora 无效，仅作对照 |
| `0923-工程完整历史.bundle` | **0923 的完整 git 历史**（2 个提交，1.38 MB）。需要时 `git clone 该文件 新目录` 可整包还原 |
| `0923-已删文件留档\` | 15 个「只存在于 git 里」的文件，已救出为普通文件 |

### `0923-已删文件留档\` 内容

```
HANDOFF.md                      Streakora 交接说明
README-本地编译.md               真机本地编译说明
Streakora-dev-prompt.md         开发提示词（20 KB）
TestFlight_Build_Submit.bat     Windows 打包脚本
TestFlight打包提交.command         macOS 打包脚本
docs/Streakora-appicon.svg      品牌图标（应用图标版）
docs/Streakora-logo.svg         品牌图标
docs/Streakora-wordmark.svg     品牌字标
docs/streakora-prototype/       旧版原型（index.html 103 KB + 两个校验脚本）
src/components/WeekGrid.tsx     周视图组件
src/lib/habitLogic.test.ts      算法测试（6.6 KB，已被 __tests__ 版取代）
install.log / typecheck.log     构建日志（无价值，仅为完整性保留）
```

## 三、原生工程本体

已整体迁到 `D:\Desktop\习惯927\native\`，**不在本目录**。
迁移校验：113 个文件 `diff -r` 逐字节零差异。转 Seeora 必改项清单见 `native\README-迁移说明.md`。

## 四、用这份资料的方式

见根目录 `从0923迁移与删除清单.md`。
如果要把 07 号文件里的规则（最长连续、连漏 2 天暂停、周期节点）并入 `index.html`，
把结论告诉我，我来改——**但那属于产品行为变更，不是 bugfix，改之前要先定清楚要不要改。**
