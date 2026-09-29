# RockSort iOS 本地编译指南

本压缩包为完整可编译的 Xcode 工程（Expo prebuild 生成原生 iOS 工程，源码 100% 保留）。

## 环境要求
- macOS + Xcode 15+
- Node.js 18+ 与 pnpm（或 npm）
- CocoaPods：`sudo gem install cocoapods`

## 编译步骤
```bash
# 1. 解压后进入项目目录
cd rocksort

# 2. 安装 JS 依赖
pnpm install        # 或 npm install

# 3. 安装 iOS 原生依赖（生成 RockSort.xcworkspace）
cd ios && pod install && cd ..

# 4. 用 Xcode 打开 workspace（注意是 .xcworkspace，不是 .xcodeproj）
open ios/RockSort.xcworkspace
```

Xcode 中选择 RockSort scheme + 目标模拟器/真机，点 Run 即可编译运行。

也可命令行一键运行：`pnpm run ios`（自动 pod install + 编译 + 启动模拟器）。

## 目录说明
- `ios/` — 原生 Xcode 工程（AppDelegate/Info.plist/图标/启动屏/entitlements）
- `src/` — 全部业务源码（expo-router 页面、store、lib、组件）
- `assets/` — 图标、启动图、分享模板等资源
- `app.json` — Expo 配置（bundle id、权限文案、通知、启动屏）
- `eas.json` — EAS 云打包配置（App Store 上架用）

## 上架前需本地配置
1. `.env` 中配置真实 `EXPO_PUBLIC_RC_IOS_KEY`（RevenueCat 苹果内购 key）
2. App Store Connect 后台建好三个商品：rocksort_pro_monthly / yearly / lifetime（价格在苹果后台设置，代码零硬编码）

## 测试
`pnpm test` — 31 条核心算法单测（dates/scoring/csv）

---

## 依赖与 EAS 构建操作规范（2026-09-19）

为避免反复踩命令行坑，统一约定如下，改项目配置前先读这里。

### 1. pnpm 不在 PATH（首次 / 任意安装）
`package.json` 已声明 `"packageManager": "pnpm@9.15.9"`。本地若 `pnpm` 报 ENOENT，统一用：
```bash
npx pnpm@9.15.9 install
```
不要假设全局 `pnpm` 可用。

### 2. pnpm workspace root 拦截
`.npmrc` 已加 `ignore-workspace-root-check=true`，允许直接在根目录 `pnpm add` 而无需 `-w`。若仍报 "adding to workspace root"，确认 `.npmrc` 此行存在，或显式 `pnpm add <pkg> -w`。

### 3. metro-core 找不到（EAS 云端 Bundle 阶段报错）
`.npmrc` 已设 `node-linker=hoisted`，把依赖拍平到顶层 `node_modules`，EAS 打包阶段即可找到 `metro-core`。`metro-core` 已在 `package.json` 的 `dependencies`（非 devDependencies）。`pnpm-workspace.yaml` 的 `overrides` 将其钉在 `0.83.7`（与 RN 0.83.2 对齐）——**保持该 override，不要删**。改 `node-linker` 后需清装（见下）。

### 4. 改完依赖后必须同步锁文件（关键）
EAS 云构建以 `pnpm-lock.yaml` 为准。只改 `package.json` 不重锁，EAS 仍按旧版本构建。流程：
```bash
del pnpm-lock.yaml
npx pnpm@9.15.9 install
# 然后再 eas build ...
```
改版本 / 加依赖 / 改 override 后都走这一步。

### 5. DIAG 诊断变量绝不能进生产包（重要）
- `.env` 仅放生产公开变量（如 `EXPO_PUBLIC_RC_IOS_KEY`）。**切勿在 `.env` 写 `EXPO_PUBLIC_DIAG`** —— `.env` 会被上传到 EAS 并被 Expo 加载，写了 DIAG 生产包就变成诊断包。
- 云端诊断构建：在 `eas.json` 的 `build.production.env` 加 `EXPO_PUBLIC_DIAG` / `EXPO_PUBLIC_DIAG_STAGE`，或 `eas build --env EXPO_PUBLIC_DIAG=1 --env EXPO_PUBLIC_DIAG_STAGE=0`。**发版前务必删掉这两个 env**。
- 本地诊断：`expo start` 前在 `.env.local`（已被 gitignore，不会上传 EAS）写入这两行即可。

