# Streakora 新项目开发提示词（适用：秒哒 / 通用 AI 编码 Agent）

> 本提示词用于从零搭建 Streakora 的全新可运行工程。**视觉与功能完整复刻现有 Streakora 设计语言与交互（依据现有 `index.html` 原型）**。功能段以下方「功能规格」为唯一权威，Agent 不得自行替换为其他产品形态（如任务清单 / 四象限）。

---

## 一、角色与总目标

你是一名资深 React Native / Expo 工程师。任务：用一套**全新、干净的技术栈基线**从零实现 Streakora，彻底规避历史遗留问题（原生依赖版本错配、启动期原生模块崩溃、metro 依赖缺失、Xcode / EAS build 编译失败等）。

- Streakora 是一款 **iOS 原生习惯打卡 App**，核心模型是「**按周统计、断签不清零、无压力**」——彻底抛弃 streak 断签=归零=放弃的完美主义焦虑。
- 交付一个**本地 `npx expo start` 能跑、EAS 云端 build 能过**的完整工程。
- 不写任何"未来再补"的占位；所有约束必须落地到 `package.json` / `eas.json` / `.npmrc` / `pnpm-workspace.yaml` / `app.config` 等真实文件。

---

## 二、产品定义与范围

**产品本质**：Streakora 解决的是「习惯打卡 App 让人因一次断签而放弃」的痛点。竞品痛点：Streaks（断签归零 / 12 习惯上限）、Productive（投入后弹付费）、Habitify（必须注册）、Coach.me（不能改 7 天前）。Streakora 的突破点：**断签不清零（按周统计，周一归零重新开始）、≥5 天即算本周达标、次周留存友好、无账号 / 无广告 / 无订阅 / 无内购（一次性买断）**。

**硬性范围（功能段，Agent 不得自行删减或替换）**：
- 今日打卡（Today）：习惯列表 + 右侧圆形按钮两步打卡（打开 App + 点圆钮），无习惯上限。
- 历史（History）：累计坚持天数 + 排行榜（按坚持天数/名称/创建时间排序，时间段分段徽章）+ 本周网格 + 近 8 周 + 热力图 + 荣誉室（智能置顶）。
- 设置（Settings）：通用（语言/外观/重看引导）+ 通知 + 设备（触感/iCloud/周起始）+ 集成（Health/Siri）+ 小组件 + 数据安全（买断说明/导出/导入/抹除）+ 关于。
- 功能：补录 7 天、迁移历史（从其他 App 导入坚持天数）、竖版分享卡、iCloud 可关、CSV/JSON 导出、中英双语（默认中文）、买断 $6.99。

---

## 三、视觉规范（复刻现有 Streakora 设计语言）

完整复刻现有 Streakora 的视觉系统，不可自行发挥风格：

- **品牌**：🎯 `Streakora` + 标语（如「无压力，不归零 / No streaks. No guilt.」）。
- **Apple HIG**：系统字体（SF Pro / iOS 系统字）、充足留白、圆角卡片（rounded-2xl）、极轻阴影、语义化颜色。
- **浅色 / 深色**：通过主题 Context + `useColorScheme` 实现，颜色走设计 token，深浅两套。
- **中英双语**：内置 `lib/i18n`，提供 `T(key, ...args)` 函数 + `zh` / `en` 词典；默认中文，设置页可切换。所有界面文案走 i18n，禁止硬编码字符串。
- **底部三 Tab 导航**：History（左）/ Today（中）/ Settings（右）；冷启动默认落在 **Today**。每页顶部仅保留 🎯 `Streakora` 名称 + 图标 + 标语（**不得出现与底部 Tab 重名的大标题**）。
- **空状态引导**：列表为空 / 无习惯时显示**灰度虚线占位引导行 / 引导卡**（虚线圆 + 灰色「添加习惯」+ 7 点示例），点击即添加。
- **条目样式**：左侧序号、右侧圆形完成按钮；小标题（习惯 / 排行榜 / 本周 / 热力图 / 荣誉室 同级）用 **21px / 800 / 深色** 突出。
- **引导流程**：首次启动 3 张引导卡（No streaks no guilt / Bring it along fix the past / Pay once use forever），支持左右滑动浏览，提供跳过与完成按钮，可重看。
- **Pro/Pay 弹层**：底部 Sheet 样式，价格由 RevenueCat 提供，文案强调一次性买断。
- **热力图 / 本周网格 / 方色块大数字**：复刻原型的视觉元素（热力图用 Less→More 渐变方块；「X 天坚持」用方型色块 + 大数字）。

---

## 四、功能规格（详细，依据 index.html 交互复刻）

### 4.1 Today（首页 / 默认页）
- 展示当天习惯列表。**两步打卡**：第 1 步打开 App，第 2 步点习惯行右侧**圆形按钮**即打卡，再点取消。
- 每条：左序号 + 标题/内容 + 每周目标 + 右侧圆形完成按钮。打卡后副文案显示「本周 X/7 · 还差 N 天达标（≥weeklyGoal）」。
- 列表底部常驻一条**灰度占位引导行**（虚线圆 + 灰色「添加习惯」+ 7 点示例），点一下即添加；无习惯时再加一张虚线大卡片。
- **习惯数量不限**。
- 新建 / 编辑表单：标题、内容/详情、图标、颜色、每周目标（weeklyGoal，每周几天算达标）、提醒时间；可开启提醒。
- **补录 7 天**：提供补录面板，可点选**最近 7 天（含今日 T-0 至 T-7）**内的任意一天补/撤打卡；超过 7 天的历史日期**置灰且不可点击**，禁止发起状态变更。
- **迁移历史**：习惯表单内含「从其他 App 导入的坚持」（总天数 / 当前连续 / 开始日期），作为荣誉并入累计。

### 4.2 周统计模型（核心交互逻辑）
- **按周统计、断签不清零**：一周从周一（可设周日）开始，结束归零重算；某天未打卡不会清零已累计。
- **≥5 天即达标**：任一习惯一周内打卡达 `weeklyGoal`（默认 5/7）即「本周达标」，其余天数为正常生活的余量，不标失败。
- 本周达标时显示 toast（如「不错——{习惯} 本周已达标 ✓」）；顶部 chips 显示「本周 X/7」「还差 N 天达标」。

### 4.3 History（历史 / 左 Tab）
- 顶部**累计坚持天数**卡片（本 App 真实打卡 + 习惯内迁移历史拆分展示：{导入} · {Streakora 内}）。
- **排行榜（Leaderboard）**：每个习惯的坚持天数，可按「坚持天数 / 名称 / 创建时间」排序；按时间段分段徽章（一年以上 / 半年以上 / 三个月以上 / 一月以上 / 一月内）。
- **本周网格**（7 格）+ **近 8 周**视图。
- **热力图**：仅真实打卡，导入历史单独隔离；Less→More 渐变。
- **荣誉室（Hall of Fame）**：从其他 App 迁移过来的坚持，单独珍藏，不计入本 App 周统计与热力图。
  - **智能位置**：一旦用户填写了迁移内容，荣誉室自动**移到历史页最上端**（累计卡之前）；暂无内容时回到底部并显示占位引导行，方便首次添加。
  - 添加项：标题 / 详情 / 坚持天数 / 来源（自定义）/ 习惯类型。
- 已移除「你的节奏」「为什么没有连续天数」两类区块。

### 4.4 分享卡
- 竖版 **1080×1920 Story** 尺寸，无第三方社交 logo；可编辑标题 + 一行备注，保存图片 / 打开系统分享。

### 4.5 Settings（设置 / 右 Tab）
- **通用（General）**：语言（中文 / EN）+ 外观（浅色 / 深色）+ 重看引导页。
- **通知（Notifications）**：每日提醒（默认关，添加习惯前不开启）/ 徽章数（今日未完成习惯数）。
- **设备（Device）**：触感反馈（Haptics）/ iCloud 同步（私有数据库，你的 Apple ID，默认关）/ 一周从周几开始（周一/周日）。
- **集成（Integrations）**：Apple Health（只读摘要）/ Siri & 快捷指令。
- **小组件（Widgets）**：今日 / 本周 / 总进度。
- **数据安全（Data security）**：买断说明（一次性 $6.99，无订阅/无内购/无账号/无广告/无追踪）+ **导出备份**（点击后选 CSV / JSON 格式）+ **导入备份**（仅 JSON 备份文件，导入前弹出覆盖确认）+ 抹掉本机所有数据（**二次确认**高风险对话框，确认后重置本地存储并回到引导页）。
- **关于（About）**：版本 / 隐私政策 / 我们的承诺（数据仅在设备与私有 iCloud，开发者看不到）。
- 所有功能开关均在 App 内，无外部工具栏。

### 4.6 Pro/Pay 弹层
- 仅在用户点击 Pro/Pay 入口时**懒加载** RevenueCat 并配置（见约束 3）。
- 商品与价格从 RevenueCat 拉取，**禁止硬编码任何价格**。
- 展示一次性买断说明（无订阅 / 无内购 / 无账号 / 数据归你）。
- 支持**恢复购买（restorePurchases）**，处理已买断用户的授权恢复。
- 拉取商品信息失败时，弹层展示**重试按钮**并提示检查网络，不得卡死。

### 4.7 本地持久化
- 本地存储优先（推荐 `expo-sqlite` 或 `@react-native-async-storage/async-storage`），可导出 JSON/CSV。
- 无强制云账号；iCloud/CloudKit 可选且默认关。

---

## 五、硬性技术约束（必须 100% 落地，附理由）

> 这些约束来自真实构建失败经验。**Agent 不得"好心"升级或顺手改动版本**——任何偏离都会直接编译失败或启动崩溃。

1. **Expo SDK 55 + Expo Router + React Native 0.83（New Architecture / Fabric）**。不要升级任何原生依赖到官方锁定版本之外（尤其 React Native、Expo 模块）。锁定版本即权威；禁止在 `npx expo install` 时顺手升 major。

2. **reanimated / worklets 必须用 Expo 官方锁定版本**：`react-native-reanimated@4.2.1` + `react-native-worklets@0.7.4`。**严禁升级到 4.5+ / 0.10+**——更高版本与 RN 0.83 的 TurboModule 签名不兼容，Xcode 会报 `RCT...TurboModule` 符号缺失而直接编译失败。若 Agent 默认想装最新版，必须显式 pin 到这两个版本。

3. **不要引入任何启动期就调用的原生模块**：
   - **RevenueCat**（`react-native-purchases`）：必须**懒加载**。只在用户真正打开 Pro/Pay 弹层时才 `Purchases.configure({ apiKey })`；禁止在 `AppProvider` / `RootLayout`(`_layout.tsx`) 顶层 configure。
   - **expo-notifications**：禁止在启动时调用 `setNotificationHandler` / `requestPermissionsAsync` / `getExpoPushTokenAsync`。仅在设置页「提醒」开关被打开时才请求权限与本地调度。
   - 任何原生 TurboModule（含第三方）禁止在 `_layout.tsx` / `AppProvider` 顶层 import 即调用。
   - 理由：启动期原生调用会在 iOS 冷启动 / EAS 预编译阶段偶发 crash，并拖慢首屏。

4. **metro 依赖必须完整**：`metro-core@0.83.7` 与 `metro-cache@0.83.7` 必须写在 `package.json` 的 **`dependencies`**（不是 `devDependencies`），版本对齐 `0.83.7`。缺失会导致 EAS build 的 bundle 阶段失败。

5. **`.npmrc` 必须包含**：
   ```
   node-linker=hoisted
   ignore-workspace-root-check=true
   ```
   （pnpm 环境下 hoisted 链接器是必须的，否则原生模块符号解析失败。）

6. **push notifications 配置选 No**：不要生成 APNs 密钥、不要写 `aps-environment`、不要配置 `expo.notifications.aps` 字段。本项目仅用本地通知调度（expo-notifications 的本地能力），权限懒加载（见约束 3）。

7. **`.env` 只放生产变量**（如 `EXPO_PUBLIC_REVENUECAT_IOS`、`EXPO_PUBLIC_REVENUECAT_ANDROID`）。所有 `DIAG_*` 调试变量走 `eas.json` 的 `env` 块，**不要混进 `.env`**。

8. **splash 图用 `expo-splash-screen` 插件托管**：在 `app.json` / `app.config` 的 `plugins` 中配置 `asset` + `backgroundColor`；JS 端**不要手动调用** `preventAutoHideAsync` / `hideAsync`（本项目无需要延后的异步初始化）。

9. **Linking 兜底**：`_layout.tsx` 顶部覆盖 `getInitialURL` / `getLinkingURL`（Expo Router 的 `Linking` 配置），把裸 scheme URL（如 `streakora://`）中性化为 `null`，避免冷启动因无法解析的 deep link 卡白屏。

---

## 六、推荐技术选型与代码分层

**技术选型**（Agent 可微调，但不得违反第五节约束）：
- 状态管理：`zustand`（轻量、RN 友好）。
- 本地存储：`expo-sqlite` 或 `@react-native-async-storage/async-storage`。
- 导航：`expo-router`（文件路由）。
- 动画：`react-native-reanimated@4.2.1` + `react-native-worklets@0.7.4`（严格 pin）。
- 支付：`react-native-purchases`（RevenueCat，懒加载封装在 `lib/purchases`）。
- 通知：`expo-notifications`（本地调度，懒加载封装在 `lib/notifications`）。
- i18n：自建轻量 `lib/i18n`（`T(key)` + zh/en 词典）。

**代码四层分离**（目录结构）：
```
app/                 # Expo Router 路由：index(Today) / history / settings / onboarding / pay
components/          # UI 组件：HabitRow / CheckButton / TabBar / Sheet / ShareCard / PlaceholderRow / Heatmap / WeekGrid / HonorRoom / Leaderboard
lib/                 # 基础设施：i18n / storage / purchases(懒) / notifications(懒) / theme / utils / weekStats
store/               # 状态：habitsStore / settingsStore / purchasesStore / honorsStore（zustand）
```

---

## 七、配置文件（必须生成且版本正确）

### `.npmrc`
```
node-linker=hoisted
ignore-workspace-root-check=true
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - "."
```

### `package.json`（关键依赖，其余对齐 Expo SDK 55 官方锁定版本）
```json
{
  "name": "streakora",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "expo": "~55.0.0",
    "react": "19.0.0",
    "react-native": "0.83.7",
    "expo-router": "~5.0.0",
    "react-native-reanimated": "4.2.1",
    "react-native-worklets": "0.7.4",
    "metro-core": "0.83.7",
    "metro-cache": "0.83.7",
    "zustand": "^5.0.0",
    "react-native-purchases": "^8.0.0",
    "expo-notifications": "~0.30.0",
    "expo-sqlite": "~15.0.0",
    "@react-native-async-storage/async-storage": "1.x"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "~19.0.0"
  }
}
```
> 注：`expo` / `react-native` / `react` 等必须对齐 Expo SDK 55 官方锁定版本；上面非精确 pin 的请以 `npx expo install` 解析出的 SDK 55 锁定值为准，但 **reanimated / worklets / metro-* 必须严格用本文指定版本**。

### `eas.json`（含 DIAG 调试变量 env 块；push 选 No）
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "DIAG_VERBOSE": "1", "DIAG_METRO_TRACE": "1" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "DIAG_VERBOSE": "0" }
    },
    "production": {
      "env": { "DIAG_VERBOSE": "0" },
      "ios": { "credentialsSource": "auto" }
    }
  },
  "submit": {
    "production": { "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." } }
  }
}
```

### `app.config.js`（splash 插件托管 + scheme + 无 APNs）
```js
export default {
  expo: {
    name: "Streakora",
    slug: "streakora",
    scheme: "streakora",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: { bundleIdentifier: "com.streakora.app", supportsTablet: true },
    plugins: [
      [
        "expo-splash-screen",
        { "asset": "./assets/splash.png", "backgroundColor": "#FFFFFF", "resizeMode": "contain" }
      ],
      "expo-router"
    ]
  }
};
```

---

## 八、开发体验要求

- **可视化预览**：开发时通过 Expo 实时预览（秒哒实时预览 / `npx expo start` + Expo Go / Dev Build）即可看到设计效果，**不需要每次打包到 TestFlight 才能看**。
- **功能完整复刻**：今日两步打卡、补录 7 天、迁移历史、累计坚持天数、排行榜（排序+分段徽章）、本周网格、近 8 周、热力图、荣誉室（智能置顶）、竖版分享卡、Pro/Pay 弹层（价格从 RevenueCat 加载，不硬编码）、本地持久化与导出导入——全部可用，不遗留占位。
- **代码分层清晰**：严格遵循第六节 `store / components / lib / app` 四层分离。

---

## 九、交付物清单

- [ ] `package.json`（依赖与版本正确，含 metro-* 在 dependencies）
- [ ] `eas.json`（含 DIAG env 块，push 选 No）
- [ ] `.npmrc`（node-linker=hoisted + ignore-workspace-root-check=true）
- [ ] `pnpm-workspace.yaml`
- [ ] `app.config.js` / `app.json`（splash 插件 + scheme + 无 APNs）
- [ ] `app/` `components/` `lib/` `store/` 四层完整源码（覆盖 Today/History/Settings/Onboarding/Pay 全部交互）
- [ ] i18n 双语词典（zh/en，默认 zh）
- [ ] 本地 `npx expo start` 可运行
- [ ] EAS 云端 build 可通过（bundle JavaScript → install pods → run fastlane 全阶段）
- [ ] 文档：`README.md`（本地预览 / EAS 打包 / TestFlight 提交 三节）

---

## 十、文档要求（README.md 三节）

1. **本地预览**：`pnpm install` → `npx expo start` → 用 Expo Go / Dev Build 扫码；说明浅色/深色与中英切换入口。
2. **EAS 打包**：`eas build --profile development/preview/production`；说明 DIAG 变量在 `eas.json` env 块、生产密钥在 `.env`、RevenueCat key 配置位置。
3. **TestFlight 提交**：`eas build --profile production` → `eas submit --platform ios`；说明 Apple ID / ascAppId / appleTeamId 填写与证书自动托管。

---

## 十一、验收标准（红线）

- 本地 `npx expo start` 正常启动，三 Tab 可切换，双语可切换，深浅可切换。
- EAS build 三阶段全过：**bundle JavaScript** 不报 metro 缺失、**install pods** 不报 reanimated/worklets 符号冲突、**run fastlane** 不报 TurboModule / 编译失败。
- 启动期无原生模块崩溃；RevenueCat 仅在打开 Pro/Pay 时 configure；通知权限仅在设置开启时请求。
- 交互复刻到位：今日两步打卡 + 本周 X/7 副文案 + 达标 toast；历史累计卡 + 排行榜（排序/分段徽章）+ 本周网格 + 近 8 周 + 热力图 + 荣誉室（有内容时智能置顶）；设置内买断卡 + 导出选格式 + 导入；补录 7 天；迁移历史。
- Pro/Pay 弹层价格来自 RevenueCat（非硬编码）；本地数据可导出 / 可抹除。

---

## 十二、禁止项（摘要）

- 禁止升级 reanimated / worklets 到 4.5+ / 0.10+。
- 禁止把 metro-* 放进 devDependencies。
- 禁止启动期调用 RevenueCat / expo-notifications / 任何原生 TurboModule。
- 禁止生成 APNs 密钥 / `aps-environment`。
- 禁止把 `DIAG_*` 写进 `.env`。
- 禁止 JS 手动 `preventAutoHideAsync` / `hideAsync`。
- 禁止硬编码任何价格。
- 禁止在页面顶部出现与底部 Tab 重名的大标题。
- 禁止把 Streakora 实现成任务清单 / 四象限形态（必须按周统计的习惯打卡模型）。

---

## 十三、异常与边界情况（必须处理，不得静默崩溃）

- **习惯列表为空**：首次进入或删空所有习惯时，列表区展示大尺寸虚线引导卡片 + 常驻引导行，引导创建第一个习惯，不得白屏。
- **补录越界**：用户尝试修改 7 天前的打卡状态 → 日期单元格置灰不可点击，禁止发起状态变更请求。
- **备份导入损坏**：导入格式损坏或非 JSON 文件 → 提示「文件格式不正确」，终止导入，**不影响当前本地数据**。
- **抹掉数据**：点击清除后弹出**二次确认**高风险对话框，确认后重置本地存储至初始状态并回到引导页。
- **支付信息获取异常**：打开买断弹层无法获取商品 → 弹层展示**重试按钮**，提示检查网络并重新加载，不得卡死。

---

## 十四、本期不实现功能（明确排除，Agent 不得自行添加）

- **社交互动体系**：不支持好友排行榜、点赞、打卡评论、习惯社区。
- **云端强制账号体系**：不提供第三方社交登录 / 手机号注册，坚持纯本地 + 私有 iCloud 方案。
- **任务清单与复杂看板**：不引入四象限、甘特图、番茄钟计时、多级任务分解等任务管理形态（Streakora 是习惯打卡，不是任务管理）。
