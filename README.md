# Seeora · v8

习惯打卡 Web 应用（单文件 HTML，由 DeepSeek 生成的 v8 完整项目包）。

## 结构

```
seeora/
├── index.html     ← 主应用（所有 JS/CSS 内联，单文件分发）
├── landing.html   ← 营销落地页（中英双语）
├── privacy.html   ← 隐私政策（中英双语）
├── terms.html     ← 使用条款（中英双语）
├── support.html   ← 支持与联系（中英双语）
├── README.md
└── assets/
    ├── brand-mark-fill.svg  ← 实心徽标（favicon / 页头）
    ├── brand-mark-line.svg  ← 描边徽标（启动画面）
    ├── style.css            ← 四个静态页共享样式
    └── lang.js              ← 静态页语言切换（en 默认 / zh）
```

## 运行

不能用 file:// 打开（通知 API / localStorage 会被浏览器拒绝），必须走本地服务：

```bash
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

- `assets/brand-mark-fill.svg`：实心徽标，用作网站 favicon（`index.html` 内 `<link rel="icon" type="image/svg+xml">` 指向它），同时作为 `apple-touch-icon` 兜底。
- `assets/brand-mark-line.svg`：描边徽标，显示在应用**启动画面（splash）**中央。
- 启动画面 `#splash`：打开页面时全屏淡入，居中显示描边徽标 + 应用名 "Seeora" + 本地化标语（见 `t().slogan`）+ 加载圈；`window.load` 后约 600ms 淡出并移除 DOM（另有 3 秒兜底，防止卡死）。无论深浅色主题，启动画面均为浅色品牌底，保证描边徽标清晰可读。

## 线上地址（已部署）

站点：**https://rocksort-4860.github.io/Streakora/**

| 页面 | 线上 URL | App Store Connect 用途 |
|---|---|---|
| 应用页 / 首页 | `https://rocksort-4860.github.io/Streakora/` | — |
| 隐私政策 | `https://rocksort-4860.github.io/Streakora/privacy.html` | **Privacy Policy URL（必填）** |
| 使用条款 | `https://rocksort-4860.github.io/Streakora/terms.html` | 自定义 EULA（如用） |
| 支持与联系 | `https://rocksort-4860.github.io/Streakora/support.html` | **Support URL（必填）** |
| 营销落地页 | `https://rocksort-4860.github.io/Streakora/landing.html` | Marketing URL（可选） |

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
