# Seeora 手机测试指南（TestFlight）

> 你已确认：Apple Developer Program 已开通、选择 TestFlight 测试、在 iPhone 上测试。
> 打包在 **EAS 云端**完成，你只需一台能联网的电脑（Mac 或 Windows）运行打包命令。

---

## 第一步：准备账号与后台配置（一次性）

### 1. 注册 Expo 账号（免费）
- 打开 https://expo.dev 注册账号
- 这是 EAS 云端打包所必需的

### 2. 创建 App Store Connect 应用记录
- 打开 https://appstoreconnect.apple.com
- 「我的 App」→ 新建 App
- 名称：`Seeora`，主语言：英文（或简体中文）
- **Bundle ID**：`com.seeora.app`（必须与工程一致）
- SKU：随意，如 `seeora`

### 3. 创建内购商品（用于真实内购测试）
Seeora 是**一次性买断**，没有订阅。在 App Store Connect → 你的 App → 「App 内购买项目」中只创建 **1 个**商品：

| 商品 ID | 类型 | 价格 |
|---|---|---|
| `seeora_pro_lifetime` | 非消耗型（Non-Consumable） | $4.99 |

- 状态设为 **Ready to Submit / Approved**，并开启 **Cleared for Sale**。
- 价格只在苹果后台维护，代码零硬编码（改价无需改代码）。
- 配置好后再到 RevenueCat 关联（见下一步）。

### 4. 创建 RevenueCat 项目（可选，首次测试可跳过）
- 打开 https://app.revenuecat.com 注册
- 新建项目 → 添加 iOS App（Bundle ID 填 `com.seeora.app`）
- 复制 `appl_` 开头的 **公开 SDK Key**
- 把 Key 填入工程根目录的 `.env` 文件：`EXPO_PUBLIC_RC_IOS_KEY=appl_xxxxx`
- 在 RevenueCat 配置 App Store Connect 的 Shared Secret

> **不配置也能测试**：App 会以「演示态」运行，点击订阅直接成功（不扣费、不连真实 App Store）。配置后才能测真实沙盒内购。

---

## 第二步：在电脑上运行打包脚本

### Windows 用户
1. 安装 Node.js（https://nodejs.org，下载 LTS 版，一路下一步）
2. 把 `TestFlight打包提交.bat` 放进工程根目录
3. 双击运行，按提示登录 Expo 账号

### Mac 用户
1. 安装 Node.js（https://nodejs.org）
2. 把 `TestFlight打包提交.command` 放进工程根目录
3. 双击运行（首次可能需右键 → 打开）

### 脚本会自动完成
- 安装 EAS CLI
- 登录 Expo 账号
- 云端构建 iOS 安装包（约 10-15 分钟）
- 提交到 App Store Connect / TestFlight

> 若提示 Apple 凭证，用你的 Apple ID（365504860@qq.com）与应用专用密码登录。

---

## 第三步：在 iPhone 上通过 TestFlight 安装

1. 在 iPhone 上打开 **App Store**，搜索安装 **TestFlight**（Apple 官方 App）
2. 打开 https://appstoreconnect.apple.com → 你的 App → **TestFlight** 标签
3. 构建成功后会出现版本，点「添加测试员」→ 填入你的 Apple ID 邮箱
4. 你会收到邮件邀请 → 点链接 → TestFlight 自动打开 → 安装 Seeora
5. 打开 Seeora 开始测试

---

## 测试要点

- **核心流程**：每天添加最多 6 件事 → 按重要×紧急自动排序 → 勾选完成（触发震动+撒花）
- **专业版**：点击首页左上角品牌图标 → 进入「方法与专业版」页 → 查看一次性买断套餐（$4.99，无订阅）与功能说明
- **内购测试**：配置了 RevenueCat 后走沙盒（不扣费）；未配置则为演示态
- **设置**：右上角齿轮 → 语言/主题切换、意见反馈、关于
- **数据**：全部本地存储，卸载即清空

---

## 常见问题

| 问题 | 解决 |
|---|---|
| 构建失败提示签名错误 | 确认 Apple Developer Program 已生效（开通后可能需等几小时） |
| TestFlight 看不到构建 | 构建需处理状态变绿（可能需 Apple 自动审核几分钟） |
| 内购提示失败 | 首次测试用演示态即可；真实内购需配 RevenueCat + App Store Connect 商品 |
| 应用专用密码报错 | 到 appleid.apple.com 重新生成（每个密码有效期） |

---

## 安全提醒

- 应用专用密码已在本对话中明文出现，建议测试完成后到 Apple ID 管理页**重新生成**一个
- `.env` 中的 RevenueCat Key 不要提交到公开仓库（工程 `.gitignore` 已自动忽略 `.env`）