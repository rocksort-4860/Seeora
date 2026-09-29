# native/ —— 从「原工作流」迁移过来的原生工程骨架

> 迁移时间：2026-09-28
> 来源：`D:\Desktop\原工作流`（原 Seeora 工程）
> 校验：**113 个文件逐字节 100% 一致**（`diff -r` 无差异），未包含 `node_modules/` 与 `.git/`

---

## 一、这是什么

这是 原工程那套 **Expo + React Native 原生工程的完整可运行骨架**，原封不动搬进来了。
它做的是另一个产品（Seeora，从未上架），**但工程配置是整个 Seeora 上架 iOS 的现成地基**：

| 已具备 | 说明 |
|---|---|
| Expo 工程配置 | `app.json` / `eas.json` / `metro` / `babel` / `tailwind` / `tsconfig` |
| 类型检查体系 | `tsc --noEmit` 曾 0 错误；`jest.config.mjs` + 用例 |
| 内购接入 | `src/lib/iap.ts`（RevenueCat 封装） |
| 防崩溃三件套 | `plugins/` 三个 config plugin，**全网唯一副本** |
| iOS 26 启动修复 | `eas.json` 的 `macos-sequoia-15.6-xcode-26.2` 镜像 + `app.json` 里 `buildReactNativeFromSource: true` + `autolinking.buildFromSource` |
| 业务实现 | `src/lib/`（存储/通知/主题/日期/国际化）、`src/components/`（热力图/螺旋环/时间曲线/分享卡）、`src/store/`、`src/app/` 页面 |

---

## 二、将来转 Seeora 必须改的地方（上架前逐项核对）

### 1. 标识类（改错会被 Apple 拒审）

| 位置 | 当前值 | 需改成 |
|---|---|---|
| `app.json` → `expo.name` | `Seeora` | `Seeora` |
| `app.json` → `expo.slug` | `seeora` | `seeora` |
| `app.json` → `expo.scheme` | `seeora` | `seeora` |
| `app.json` → `expo.owner` | `seeora` | 你的 Expo 账号 |
| `app.json` → `ios.bundleIdentifier` | `com.seeora.app` | **必须与 Apple 开发者后台 App ID 完全一致** |
| `app.json` → `android.package` | `com.seeora.app` | 同上（若发安卓） |
| `app.json` → `extra.eas.projectId` | `00000000-...`（**占位符**） | `eas init` 生成的真实值 |
| `eas.json` → `submit.production.ios.appleId` | `REPLACE_WITH_YOUR_APPLE_ID@example.com` | 你的 Apple ID（记忆里是 `365504860@qq.com`） |
| `src/lib/i18n.ts` | Seeora 文案 | 全量换 Seeora |
| `app.json` → `expo-image-picker` 权限文案 | 含「允许 Seeora…」 | 换 Seeora |

### 2. 视觉类

| 位置 | 当前值 | 需改成 |
|---|---|---|
| `assets/icon.png` / `adaptive-icon.png` / `splash.png` / `favicon.png` | Seeora 占位图 | Seeora 品牌图（`习惯927/assets/brand-mark-fill.svg` 可导出 1024×1024） |
| `app.json` → 通知色 `#5B5BD6` | 紫色 | Seeora 品牌绿 `#2d7a6b` |
| `app.json` → android `adaptiveIcon.backgroundColor` | `#5B5BD6` | `#2d7a6b` |
| `app.json` → splash `backgroundColor` | `#5B5BD6` | `#2d7a6b` |
| `src/lib/tokens.ts` | Seeora 设计令牌 | 对齐根目录 `assets/style.css` 的 `#2d7a6b` 体系 |

### 3. 提审前必须摘除

```
app.json → plugins 里的这三行（崩溃诊断用，审核版不要）：
  "./plugins/crashReason/withCrashReason",
  "./plugins/turboModuleFix/withTurboModuleFix",
  "./plugins/withFmtConstevalFix",
```
> 摘除后必须**重新构建**再提审。文件本身保留在 `plugins/` 里（`参考/防崩溃三件套/` 另有一份留档）。

### 4. 权限类（App Store 隐私审查会问）

`app.json` → `android.permissions` 里有两项**习惯打卡 App 用不到**，会被问用途，建议删：
```
android.permission.RECORD_AUDIO              ← 录音，不需要
android.permission.READ_EXTERNAL_STORAGE     ← 读外部存储，不需要
android.permission.WRITE_EXTERNAL_STORAGE    ← 写外部存储，不需要
```
（只用相册选图的话，Expo 的 `expo-image-picker` 已自带 iOS 侧权限声明）

### 5. 环境变量

- `.env` —— 三个键全是**占位符**（`appl_REPLACE_...`），没有真凭据泄露风险
- `.env.example` —— 存着 **Seeora 的旧 RevenueCat key**（`appl_cbbB...`），**对 Seeora 无效**
- Seeora 需要新申请：`EXPO_PUBLIC_APP_ID`（EAS 项目 ID）+ `EXPO_PUBLIC_REVENUECAT_IOS_KEY`（RevenueCat 里 Seeora 项目的 iOS Public SDK Key）

---

## 三、怎么跑起来（等你账号备好后）

```bash
cd D:/Desktop/习惯927/native
pnpm install          # 若没装 pnpm，用 npm install（pnpm-lock.yaml 会失效，可接受）
npx tsc --noEmit      # 类型检查
npx expo start        # 本机预览
```
> ⚠️ 这台机器是 Windows，**不能本地出 iOS 包**，必须走 EAS 云端构建（`eas build -p ios`）。

---

## 四、目录导览

```
native/
├── app.json / eas.json / package.json / tsconfig.json      ← 工程配置（见上表要改）
├── metro.config.js / babel.config.js / tailwind.config.js
├── pnpm-lock.yaml / pnpm-workspace.yaml / .npmrc
├── .env / .env.example                                      ← 环境变量（全占位，无真凭据）
├── src/
│   ├── app/          页面（expo-router，root=src/app）
│   ├── components/   组件（热力图/螺旋环/分享卡/…）
│   ├── lib/          iap.ts 内购 / storage / notify / theme / i18n / dates / tokens
│   ├── store/        状态（app.tsx / useHabitActions / usePersist / usePro）
│   └── global.css
├── plugins/          防崩溃三件套（唯一副本，提审前摘除）
├── assets/           Seeora 占位图标/splash（要换）
├── docs/             设计系统 + 开发提示词 + 工程参考（与 参考/ 有重复，是刻意的完整快照）
└── index.html        Apple 设计规范原型（≈ 参考/09-Apple设计规范原型.html，重复但保留）
```

---

## 五、与仓库其他部分的关系

| 位置 | 角色 |
|---|---|
| 仓库根目录 `index.html` + 4 个静态页 | **Seeora Web 定稿**，已上线 GitHub Pages，别动 |
| `native/`（本目录） | **未来 Seeora iOS 工程的落地处**，现为 原工程 迁移骨架 |
| `参考/` | 迁移文档库 + 防崩溃三件套留档 + 原工程完整 git 历史包 + 已删文件留档 |

**原工程完整 git 历史**（含 15 个后来被删的文件）已备份为：
`参考/工程完整历史.bundle` —— 需要时用 `git clone 该文件 新目录` 即可完整还原。
