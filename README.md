# Seeora · v8

习惯打卡 Web 应用（单文件 HTML，由 DeepSeek 生成的 v8 完整项目包）。

## 结构

```
seeora/
├── index.html   ← 主文件（所有 JS/CSS 内联，单文件分发）
├── README.md
└── assets/      ← 预留，未来放图片
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

## 关键约束

- 绝不使用 file://，必须走 localhost
- 每次改完代码测试前，控制台 `localStorage.clear()`
- 所有 localStorage key 前缀必须是 `seeora_`，不要混入其他项目数据
- 若未来拆分 styles.css / app.js，保持 index.html 的 id 不变
