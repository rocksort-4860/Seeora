# Streakora 项目交接说明（给总管）

> 本文件用于「总管」接手本项目时快速建立上下文。所有内容均可在本目录内查证。

## 1. 项目是什么
**Streakora** —— iOS 原生习惯打卡 App。核心主张「按周统计、断签不清零、无压力」：
- 以周为维度统计打卡（每周达标天数 ≥ weeklyGoal 即本周达标），单日未打卡**不清零历史总天数**。
- 一次性买断 **$4.99 终身**（无订阅、无内购连续扣费、无账号、无广告、无第三方追踪）。
- 中英双语，**默认英文**（优先上架海外 App Store / 北美）。
- 纯本地持久化（AsyncStorage），无后端、无云账号；iCloud 同步为可选开关。

## 2. 技术栈与硬性约束（务必遵守，否则 iOS 启动即崩）
技术栈（**版本钉死，禁止升级**）：Expo SDK 55.0.6 · React Native 0.83.2 · expo-router 55.0.5 · NativeWind 4.2.3 + tailwindcss 3.4.17 · **react-native-reanimated 4.2.1 + react-native-worklets 0.7.4**（禁升 4.5+/0.10+）· React 19.2.0 · TypeScript 5.9.2 · pnpm 9.15.9。

崩溃防护红线（已在基线中落实，勿改动）：
1. **iap 懒加载**：`src/lib/iap.ts` 用 `await import("react-native-purchases")` 动态加载 + `Purchases.configure`，**只在 Pay Sheet 打开时才初始化**；禁止顶层 import、禁止启动期 configure。
2. `expo-notifications` **不在启动期请求权限**，仅用户首次为习惯设提醒时请求。
3. 不在 `_layout.tsx` 顶层调用任何原生 TurboModule。
4. **Linking 兜底**：`src/app/_layout.tsx` 顶部覆盖 `Linking.getInitialURL`，把裸 `streakora://` 中性化为 `null`。
5. `app.json`/`eas.json`/`.npmrc`/`package.json` 已含：metro-core+metro-cache 进 dependencies、`node-linker=hoisted`、`ignore-workspace-root-check=true`、push 选 No、splash 用插件托管、防崩溃三件套插件（crashReason / turboModuleFix / withFmtConstevalFix）。
6. 真实深色模式（`src/global.css` 的 `:root` 与 `.dark` 均定义完整 HSL 令牌，靛紫 `#5B5BD6` 为品牌色）。

## 3. 当前状态
- ✅ **基线完整**：配置层 + 防崩溃插件 + 32 个 shadcn-RN UI 组件（`src/components/ui/*`）+ 通用 lib（utils/storage/csv/haptic/notify/theme/tokens/swipeBus）+ Toast/Confetti。
- ✅ **领域代码已全量写入**（工程师寇豆码完成，因 429 限流中断于最后验证步，非未写）：
  - 页面 `src/app/`：_layout、index（三 Tab：History 左 / Today 中默认 / Settings 右）、today、history、settings、onboarding、pro（买断页）、share（分享卡页）。两页于 2026-09-23 由总管续建完成（此前为断点）。
  - 组件 `src/components/`：HabitRow、HonorRoom、Leaderboard、WeekGrid、Heatmap、HabitForm、HonorForm、ExportSheet（CSV/JSON 导出+JSON 导入）、BuyoutCard、ModalHost + 复用 ui 库。
  - 状态 `src/store/`：app（Context 状态机）、usePersist、usePro、useHabitActions。
  - 逻辑 `src/lib/`：i18n（默认 en，中英全量文案）、dates（周统计）、habitLogic（纯函数 + `src/lib/__tests__/habitLogic.test.ts` 单测，**2026-09-22 总管补建并跑通 12/12**）、iap（懒加载，商品 `streakora_pro_lifetime`）。
  - `src/global.css`（靛紫令牌+深色）、`src/lib/tokens.ts`。
- ✅ **TypeScript 全量 typecheck 已通过**（2026-09-23 总管执行 `tsc --noEmit`，从 29 个遗留类型错误清零；2026-09-22 进一步收紧一处原生模块懒加载后重跑仍为 0 错误）。
- ✅ **jest 单测已跑通**（2026-09-22 总管发现 handoff 误称 `src/lib/habitLogic.test.ts` 已存在而实际缺失，于 `src/lib/__tests__/habitLogic.test.ts` 补建，覆盖周统计/断签不清零/导入隔离/排行榜/徽章/近8周/热力图，**12/12 通过**）。
- ⚠️ **未验证项**：`npx expo start` 真机/模拟器预览无法在本沙箱跑（无 Xcode/真机），待 EAS 构建后真机验证。

## 4. 目录结构
```
工作流0923/
├─ app.json / eas.json / .npmrc / package.json / pnpm-workspace.yaml / tsconfig.json
├─ babel.config.js / metro.config.js / tailwind.config.js / jest.config.mjs / biome.json
├─ plugins/                # 防崩溃三件套（勿改）
├─ assets/                 # 品牌图（2026-09-23 重设计为专业版）：icon.png（1024×1024 满幅直角）/ splash.png（居中留白 logo）/ adaptive-icon.png（Android 满幅） / favicon.png（web）
├─ src/
│  ├─ app/                 # 路由页面（_layout/index/today/history/settings/onboarding）
│  ├─ components/          # 业务组件 + ui/（shadcn-RN）
│  ├─ store/               # app/usePersist/usePro/useHabitActions
│  ├─ lib/                 # i18n/dates/habitLogic(+test)/iap/...
│  ├─ types/assets.d.ts
│  └─ global.css
├─ docs/                   # 设计/原型/PRD
│  ├─ Streakora-dev-prompt.md   # 给秒哒的完整工程提示词（含 9 条约束）
│  ├─ Streakora-design-system.html  # 设计系统+5个Logo（已选 A·周环）
│  ├─ Streakora-logo.svg / -appicon.svg / -wordmark.svg
│  ├─ streakora-prototype/      # 可点击 HTML 原型（功能验收基准）
│  └─ rockSort参考/             # 918 基线时期的参考文档（方法论，非 Streakora 规格）
└─ README.md / README-本地编译.md / TestFlight_*.{bat,md,command}
```

## 5. 总管接手待办（建议顺序）
1. **装依赖**：`cd 工作流0923 && npx pnpm@9.15.9 install`（若 pnpm 不在 PATH，用此命令；锁文件 `pnpm-lock.yaml` 已就位，勿手改 package.json 版本）。
2. ~~**跑单测**：`jest src/lib/__tests__/habitLogic.test.ts`~~ **已完成（2026-09-22）：补建测试文件并跑通 12/12，ts-jest + node 环境，@/ 别名解析正常**。
3. ~~**类型检查**：`tsc --noEmit` 修类型错误~~ **已完成（2026-09-23）：tsc --noEmit 零错误，共修 29 处**。
4. **本地预览**：`npx expo start`（手机/模拟器扫码或 `npx expo run:ios`）。确认默认英文、三 Tab、Today 两步打卡、History 排行榜/热力图/荣誉室智能置顶、Settings 买断说明。
5. **上架前置**：
   - ~~替换 `assets/icon.png`、`assets/splash.png`~~ **已完成（2026-09-23）：AI 生成品牌火焰图标 + 去水印/满幅规范化**。
   - RevenueCat 后台建商品 `streakora_pro_lifetime`（一次性买断），价格仅后台维护；`.env` 填 `EXPO_PUBLIC_RC_IOS_KEY`。
   - `eas.json` 的 `submit.production.ios.appleId` 与 `app.json` 的 `extra.eas.projectId` 改为真实值（先 `eas init` 建项目）。
   - App Store Connect 填隐私政策（见 `src/app/settings.tsx` 关于页文案）、年龄分级、截图。
6. **EAS 构建**：`eas build --platform ios --profile production`（配置已含 `macos-sequoia-15.6-xcode-26.2`、`EAS_USE_PRECOMPILED_MODULES=0`、防崩溃插件）；`eas submit` 提交 TestFlight。

## 6. 已知风险/缺口
- 工程师在 429 中断前**未做全局 typecheck 与 jest 实跑**，可能残留类型错误，需总管先跑 `tsc --noEmit` 修复。
- `app.json` 的 `bundleIdentifier: com.streakora.app`、`eas.projectId` 为占位，上线前必须替换。
- 原生真机/EAS 构建是否能过，需实际 `eas build` 验证（本环境无 Xcode，无法代验）。
- `src/app/share.tsx`（分享卡页）已建：屏上卡片预览 + 主标题/备注编辑 + 「复制」(expo-clipboard) 与「系统原生分享」(React Native Share)。**真·1080×1920 图片导出（需加 react-native-view-shot）为后续增强**，待人工确认加依赖后再做。Settings 的 Apple Health/Siri/Widgets 仍为占位入口，按 RD 第 3.2 节可后续细化。
- **DIAG 诊断变量**（`EXPO_PUBLIC_DIAG*`）只能走 `eas.json` env 或 `.env.local`，**禁止写进 `.env` 上传生产包**（详见 `README-本地编译.md`）。
- 环节⑤审计结论（2026-09-22）：补建 habitLogic 单测 12/12 通过；崩溃红线全部就位——iap 全程动态 `import`（启动期不碰 RevenueCat 原生 TurboModule）、Linking 兜底就位、expo-notifications 权限仅用户设提醒时申请（已进一步把 notify.ts 顶层 `import * as` 改为 `import type`，启动期零原生模块求值）；全 `src` 唯一顶层原生模块引用即 expo-notifications（Expo 核心模块，安全）。商品 ID 唯一真源 `streakora_pro_lifetime`；价格零硬编码。无功能性 TODO/未实现残留；仅 Settings「扩展集成」(Health/Siri/Widgets) 为设计明确的延后占位。
