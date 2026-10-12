# Seeora — iOS 习惯打卡 App（Expo 工程）

> 按周统计 · 断签不清零 · 无压力。一次性买断（$4.99 终身），无账号、无订阅、无广告、纯本地优先。
> 默认语言 **英文（en）**，优先上架海外 App Store；设置内可切中文。

---

## 1. 技术栈（已锁定，勿升级原生依赖）

| 项 | 版本 |
|---|---|
| Expo SDK | 55.0.6 |
| React Native | 0.83.2（新架构） |
| expo-router | 55.0.5 |
| react-native-reanimated | **4.2.1**（官方锁定，禁升 4.5+） |
| react-native-worklets | **0.7.4**（官方锁定，禁升 0.10+） |
| NativeWind / tailwindcss | 4.2.3 / 3.4.17 |
| RevenueCat (react-native-purchases) | 10.9.0（**启动期懒加载**，仅 Pay 弹层打开时 configure） |
| React / TypeScript | 19.2.0 / 5.9.2 |
| 包管理 | pnpm 9.15.9（`.npmrc` 已设 `node-linker=hoisted` + `ignore-workspace-root-check=true`） |

本工程由 Seeora 可运行基线（D:\Desktop\原工程）复制而来，配置层（app.json / eas.json / .npmrc / package.json 等）已含全部防崩溃设置，**请勿改动**。

---

## 2. 目录结构

```
seeora/
├── app.json                 # Expo 配置（bundle id com.seeora.app、权限文案、splash、防崩溃插件）
├── eas.json                 # EAS 云构建 / 提交 TestFlight 配置
├── .npmrc                   # node-linker=hoisted 等
├── pnpm-workspace.yaml      # metro-core/cache 钉 0.83.7 + 其他 override
├── package.json             # 依赖（与基线一致）
├── babel.config.js / metro.config.js / tsconfig.json / tailwind.config.js
├── plugins/                 # 防崩溃三件套：crashReason / turboModuleFix / withFmtConstevalFix
├── assets/                  # icon / splash / adaptive-icon / favicon（请替换为 Seeora 周环标识）
└── src/
    ├── app/
    │   ├── _layout.tsx       # 根布局：GestureHandler + AppProvider + Tabs + Linking 兜底 + 崩溃诊断开关
    │   ├── index.tsx         # Tabs 容器（History 左 / Today 中默认 / Settings 右）
    │   ├── today.tsx / history.tsx / settings.tsx
    │   ├── pro.tsx（Pay Sheet）/ share.tsx（分享卡）
    ├── components/           # HabitRow / HonorRoom / Leaderboard / WeekGrid / Heatmap / HabitForm / HonorForm / ExportSheet / BuyoutCard / ModalHost / Toast / Confetti
    ├── components/ui/        # shadcn-RN 组件库（32 个，与基线一致）
    ├── store/                # app.tsx（Context 状态机）+ usePersist / usePro / useHabitActions
    ├── lib/                  # i18n / dates / habitLogic(+test) / iap / storage / csv / utils / theme / tokens / haptic / notify / swipeBus
    └── global.css            # 设计令牌（靛紫 #5B5BD6，真实深色模式）
```

---

## 3. 本地预览（可视化开发，无需每次打 TestFlight）

```bash
cd seeora
npx pnpm@9.15.9 install        # 首次或改依赖后；全局无 pnpm 时用 npx 这条
npx expo start                  # 或 pnpm start
```
- 真机：Expo Go / 开发版扫码；iOS 模拟器按 `i`。
- 改完 `package.json` 后**必须** `del pnpm-lock.yaml` 再 `npx pnpm@9.15.9 install`，否则 EAS 仍用旧锁。

---

## 4. EAS 云端构建（bundle JS → install pods → fastlane）

```bash
# 登录 EAS（首次）
npx eas login

# 初始化项目（仅首次；会把真实 projectId 写回 app.json 的 extra.eas.projectId）
npx eas init

# 生产构建（iOS）
npx eas build --platform ios --profile production
```
- `eas.json` 已设 `image: macos-sequoia-15.6-xcode-26.2`、`credentialsSource: remote`、`EAS_USE_PRECOMPILED_MODULES: 0`。
- `metro-core` / `metro-cache` 已在 `dependencies` 且 `pnpm-workspace.yaml` 钉 `0.83.7`（与 RN 0.83.2 对齐），保证 EAS Bundle 阶段能找到。

---

## 5. 提交 TestFlight / App Store

```bash
npx eas submit --platform ios --profile production
```
- 提交前在 `eas.json` 的 `submit.production.ios.appleId` 填入你的 Apple ID（当前为占位符）。
- App Store Connect 后台建**一个**内购商品 `seeora_pro_lifetime`（买断，价格 $4.99，在苹果后台设，代码零硬编码）。
- ★ **打包用的 RevenueCat key 写在 `eas.json` → `build.production.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY`**（已填真实值）。
  原因：`native/.env` 被 `.gitignore` 忽略，而 EAS 云端构建默认按 `.gitignore` 排除上传的文件
  （Expo 官方 `build-reference/easignore`：*"By default, the EAS CLI refers to the .gitignore file (if it exists)
  to determine which files to ignore"*；`eas/environment-variables` 也明说被 gitignore 的 `.env`
  *"are not available for jobs that run on a remote server, for example, EAS Build"*）。
  → **只在 `.env` 里配 key，本地 `npx expo start` 一切正常，线上包却拿不到 key**：价格位显示「—」、买断点了回失败。
  `.env` 仅服务于本地开发，**两处必须保持一致**（`npm run lint` 已加门禁自动比对）。
- ★ RevenueCat 后台还需三项，缺任一项都会表现成「价格出不来」（代码按 `offerings.current` 取价）：
  ① 建 iOS App 且 Bundle ID = `com.seeora.app`；② 建 Entitlement `seeora_pro` 并挂上该商品；
  ③ 建**当前（Default）Offering**，把 `seeora_pro_lifetime` 作为 Lifetime 包挂进去。
- **切勿在 `.env` 写 `EXPO_PUBLIC_DIAG`**（本地包会变成诊断包）。
- 云端诊断构建：`eas build --env EXPO_PUBLIC_DIAG=1 --env EXPO_PUBLIC_DIAG_STAGE=0`；发版前删掉这两个 env。

---

## 6. 防崩溃要点（iOS 26 / RN 0.83 启动期原生崩溃）

1. **reanimated 4.2.1 + worklets 0.7.4 严格锁定**，升级会 Xcode 编译失败。
2. **RevenueCat 启动期绝不 import / configure**：`src/lib/iap.ts` 用动态 `import()` 懒加载，仅 Pay 弹层打开时才初始化。
3. **expo-notifications 不在启动期请求权限**；仅用户首次设置习惯提醒时才请求。
4. **Linking 兜底**：`_layout.tsx` 顶部覆盖 `Linking.getInitialURL`，把裸 `seeora://` 中性化为 `null`。
5. **三个插件**（app.json 已挂）：`crashReason` / `turboModuleFix` / `withFmtConstevalFix` —— 解决 iOS 26 启动 SIGABRT。
6. `autolinking.ios.buildFromSource` 含 reanimated/worklets；`expo-build-properties` 开 `buildReactNativeFromSource: true`。
7. push 配置选 **No**（未生成 APNs 密钥）。

---

## 7. 本地化

- 默认英文。设置 › 通用 › 语言 可在 中文 / EN 间即时切换，全应用静态+动态文案即时更新。
- 文案集中在 `src/lib/i18n.ts`（`I18N.zh` / `I18N.en`，`getDict(lang)` / `fmt(tpl, o)`）。

---

## 8. 测试

```bash
npx pnpm@9.15.9 test
```
- 核心纯逻辑单测：`src/lib/habitLogic.test.ts`（周统计 / 断签不清零 / 导入隔离 / 排行榜排序 / 时间段徽章阈值）。

---

## 9. 资源替换清单（上架前）

- `assets/icon.png`（1024²）、`assets/splash.png`、`assets/adaptive-icon.png`、`assets/favicon.png`：替换为 Seeora 周环标识（设计源见 `Seeora-appicon.svg`）。
- `app.json` 的 `extra.eas.projectId`：运行 `eas init` 后自动填充真实值（当前为占位符）。
- `eas.json` 的 `appleId`、`.env` 的 RevenueCat key：替换为你的真实值。
