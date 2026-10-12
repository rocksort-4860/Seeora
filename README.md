# Seeora · v8

> **⚠️ 2026-10-12 更新：本文件描述的是 Web 原型。上架主体已是 `native/` 下的 Expo + RN 工程（SDK 55，build 10）。**
> 当前进度与待办看 `上架准备清单.md`（唯一定稿追踪），细项审计看
> `Seeora-上架审核专家全量检查报告.md`。本 README 下文「付费模式 / 恢复购买」里的
> localStorage 模拟**只适用于 Web 原型预览，不是上架版本的真实行为**——
> 上架版走 RevenueCat + StoreKit，商品 `seeora_pro_lifetime`，凭证在苹果服务器、重装不丢。
>
> 根目录的 `index.html` / `landing.html` / `privacy.html` / `terms.html` / `support.html`
> **已移入 `静态网页/`**（10-11 目录整理）。下文「结构」与「运行」章节按此理解。

## 结构

```
习惯927/
├── native/           ← 【上架主体】Expo SDK 55 + RN 0.83 工程，当前 build 10
│   ├── app.json               bundle id com.seeora.app / 权限文案 / 插件 / 隐私声明
│   ├── eas.json               production profile：sdk-55 镜像 + RC key env 注入 + submit 配置
│   ├── src/                   expo-router 页面、store、i18n、widgetSync、付费墙
│   ├── modules/widget-sync    App Group 数据桥（小组件取数）
│   ├── targets/widget         WidgetKit 扩展（小/中尺寸）
│   ├── plugins/               iOS26 启动崩溃专项修复 4 件套（提审包勿摘）
│   └── README-迁移说明.md     转 Seeora 必改配置清单（bundle id / 品牌色 / 权限…）
├── 静态网页/         定稿四页 + 主应用（index / landing / privacy / terms / support）
│                    线上：https://rocksort-4860.github.io/Seeora/
├── assets/           品牌标 SVG、icon-1024 母版、apple-touch-icon、共享 css/js
├── 商店截图_1206x2622\  【唯一送审用图】6.3"，5 张真实 UI + _raw 母版
├── 参考/             迁移文档库 + 防崩溃三件套 + 原工程完整 git 历史包
├── _过程文件\        历轮审计/反馈/修复说明报告、白屏核验包、DeepSeek 复核包、迁移清单
├── README.md              本文件
├── 上架准备清单.md         【唯一定稿进度追踪】
├── ASC上架清单.html        ASC 后台逐项照抄版
├── Seeora-上架审核专家全量检查报告.md   权威审计报告（2026-10-11，85 文件 + 81 单测）
└── 从原工程迁移与删除清单.md
```

**常驻工具脚本不是临时件**：`_verify_fix.js` / `_verify_swipe.js` / `_check_pages.cjs`
在 `.gitignore` 里被明文标注为「常驻守卫，必须保留」；`_shot_real.js`（依赖
`_serve_dist.js`）是全量检查报告点名的**商店截图流水线**，固定走 `expo export` 静态导出。

## 运行（Web 原型预览）

> 上架版请用 `native/` + EAS 构建，见 `上架准备清单.md`。以下仅为 Web 原型预览方式。

不能用 file:// 打开（通知 API / localStorage 会被浏览器拒绝），必须走本地服务：

```bash
cd 静态网页
python -m http.server 5173
# 或：npx serve -p 5173
```

浏览器打开：http://localhost:5173

首次运行前，在浏览器控制台（F12）执行一次，避免旧缓存干扰：

```js
localStorage.clear(); location.reload();
```

## 演示用隐藏开关（控制台）

```js
// 模拟 IAP 请求失败（付费墙卡 8 秒后显示失败态）
localStorage.setItem("seeora_iap_sim", "fail"); location.reload();
// 恢复正常
localStorage.removeItem("seeora_iap_sim"); location.reload();
// 切换 Pro / 免费
localStorage.setItem("seeora_pro", "1");   // Pro
localStorage.setItem("seeora_pro", "0");   // 免费
// 切换主题
localStorage.setItem("seeora_theme", "dark");
// 切换语言
localStorage.setItem("seeora_lang", "zh");
```

## 付费模式

- **免费版**：正常使用，习惯上限 5 条，打卡 / 补签 / 休息日 / 连续统计 / 热力图等核心功能全部可用，分享成就卡带 Seeora 水印。
- **专业版（Pro）**：一次性买断 **$4.99**，永久解锁（无限习惯、去水印、数据导出等）。
- **7 天免费试用**：点"开始 7 天免费试用"后进入限时 Pro 状态，倒计时 **7 天**；到期自动回退免费版，需买断才能继续使用 Pro 功能。试用状态只记录 `seeora_pro_trial_until` 截止时间戳，不会污染 `seeora_pro`（买断后试用标记自动清空）。

### 恢复购买（Restore Purchases）

付费墙底部"恢复购买"按钮，对应 App Store / RevenueCat 的 Restore 流程：

- 买断时写入**购买凭证** `seeora_receipt`（模拟 App Store 服务端记录：`{type:"lifetime", at:<时间戳>}`），与本地解锁标记 `seeora_pro` **分离存储**。
- 点"恢复购买" → 模拟向商店拉取已购记录（1500ms 加载）→ 若凭证存在且为 lifetime，则重新写入 `seeora_pro="1"` 解锁 Pro 并提示"已恢复 Pro"；若无凭证则提示"没有可恢复的购买记录"。
- 本地解锁标记丢失（如手动 `seeora_pro="0"`、版本升级、重装但保留数据）后，可用"恢复购买"找回 Pro，无需重复付费。
- 与"试用"无关：Restore 只恢复**买断**，不恢复限时试用（与真机一致）。
- 受 `seeora_iap_sim="fail"` 影响：开启后恢复会提示"恢复失败，请稍后重试"（按钮本身即重试入口）。
- ⚠️ 局限性：本原型无后端，凭证同样存于 localStorage，因此 `localStorage.clear()` 会一并清除凭证（真机中凭证在苹果服务器、重装不丢）。同浏览器内的"本地标记丢失→恢复"场景可完整演示。

## 品牌图标与启动画面

- 品牌标为「三圆串联 ✓✓○」横版标（品牌绿 `#2d7a6b` + 奶油底 `#FAF9F4`）：
  - `assets/icon-1024.png`：母版（设计源图）。`assets/mark-transparent.png`：从母版抠出的透明底 PNG。
  - `assets/brand-mark-fill.svg`：矢量·应用图标版（奶油圆角底 + 品牌标），用作网站 favicon；`apple-touch-icon` 用 `assets/apple-touch-icon.png`（180×180，iOS 不支持 SVG 图标）。
  - `assets/brand-mark-line.svg`：矢量·透明底版，显示在应用**启动画面（splash）**中央。
- 启动画面 `#splash`：打开页面时全屏淡入，居中显示品牌标（宽 `min(300px,64vw)`，适配横版）+ 应用名 "Seeora" + 本地化标语（见 `t().slogan`）+ 加载圈；`window.load` 后约 600ms 淡出并移除 DOM（另有 3 秒兜底，防止卡死）。无论深浅色主题，启动画面均为浅色品牌底，保证品牌标清晰可读。
- 分享卡片上的品牌角标由 `drawBrandIcon()` 用 Canvas 按同一几何实时绘制（与 SVG 同源）。
- 原生工程 `native/assets/`：`icon.png`（=icon-1024）/ `adaptive-icon.png`（透明前景，标占 60%）/ `splash.png`（透明底，标占 55%）/ `favicon.png`；`native/app.json` 中 splash 与 adaptiveIcon 背景色为奶油色 `#FAF9F4`。

## 线上地址（已部署）

站点：**https://rocksort-4860.github.io/Seeora/**

| 页面 | 线上 URL | App Store Connect 用途 |
|---|---|---|
| 应用页 / 首页 | `https://rocksort-4860.github.io/Seeora/` | — |
| 隐私政策 | `https://rocksort-4860.github.io/Seeora/privacy.html` | **Privacy Policy URL（必填）** |
| 使用条款 | `https://rocksort-4860.github.io/Seeora/terms.html` | 自定义 EULA（如用） |
| 支持与联系 | `https://rocksort-4860.github.io/Seeora/support.html` | **Support URL（必填）** |
| 营销落地页 | `https://rocksort-4860.github.io/Seeora` | Marketing URL（可选） |

**对外身份口径（已确认）**
- 开发者：个人开发者 **张新华 / Zhang Xinhua**（非公司主体）
- 联系邮箱：`365504860@qq.com`
- 生效日期：**2026 年 10 月 1 日**
- 版权署名：`© 2026 Seeora · 张新华`（EN：`© 2026 Seeora · Zhang Xinhua`）
- 隐私卖点：无账号 / 无服务端 / 无第三方埋点 / 数据本地存储；IAP 经 Apple App Store + RevenueCat 处理

## 关键约束

- 绝不使用 file://，必须走 localhost
- 每次改完代码测试前，控制台 `localStorage.clear()`
- 所有 localStorage key 前缀必须是 `seeora_`，不要混入其他项目数据
- 若未来拆分 styles.css / app.js，保持 index.html 的 id 不变
- 静态页语言切换复用 `seeora_lang` 键（与 App 内一致），默认英文（`en`），中文为 `zh`
