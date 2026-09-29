# Seeora iOS 26 冷启动修复 · 终版可用配置组合

> **用途**：把「多次尝试后最终能正常冷启动进首页」的最小必要配置固化下来，供秒哒（Miaoda）给其他同类 Expo 项目输出代码时直接套用。
> **适用环境**：Expo SDK 55 / React Native 0.83.2 / iOS 26 企业签名真机（爱思助手安装）。

---

## 一、环境基线（已验证可用）

| 项 | 版本 / 取值 |
|---|---|
| Expo SDK | 55 |
| React Native | 0.83.2 |
| react-native-reanimated | 4.2.1（走源码编译） |
| react-native-worklets | 0.7.4（走源码编译） |
| expo-router | 启用（路由） |
| react-native-screens | 4.25.2 |
| react-native-purchases | ^10.9.0（营收/订阅） |
| 真机 | iOS 26，企业签名分发 |

---

## 二、两个必改项（真因，缺一不可）

启动崩溃分两层，两层都修好才进得了首页：

### ① 缺自定义 scheme（深链 JS 异常 → iOS 26 原生崩溃）
- 在 `app.json` **顶层**加：`"scheme": "seeora"`（值可自定义，但**必须有**）。
- 没有它，expo-router 启动期 `getInitialURL → getRootURL → createURL` 会抛
  `Cannot make a deep link into a standalone app with no custom scheme defined`，
  iOS 26 把它升级成原生崩溃（abort）。

### ② 路由根配错（`/` 找不到页面 → Unmatched Route 404）
- `expo-router` 插件选项 `"root"` 必须是 `"src/app"`（**不是** `"src"`）。
- `extra.router.root` 也必须是 `"src/app"`（**不是** `"src"`）。
- 错配成 `"src"` 会让整层 `src/` 被当成路由目录，`/` 没有页面 → 显示
  `Unmatched Route / Page could not be found.`。

> **关键认知**：expo-router 官方打包器读的是 `extra.router.root`；而 `expo-router` 插件选项 `root` 会被写进 `extra.router.root`。所以**两处都要写 `"src/app"`**，二者必须一致。

---

## 三、建议保留项（安全网 / 必要补丁，非真因但与该环境兼容）

这些不是启动崩溃的根因，但保留可避免回归：

- 项目内自定义插件（`plugins/` 目录）：
  - `./plugins/crashReason/withCrashReason`
  - `./plugins/turboModuleFix/withTurboModuleFix`（iOS 26 原生异常安全网）
  - `./plugins/withFmtConstevalFix`（编译期 consteval 修复）
- `expo-build-properties`：`ios.buildReactNativeFromSource: true`（RN 走源码编译，匹配该环境）
- `autolinking.ios.buildFromSource: ["react-native-reanimated", "react-native-worklets"]`
- `ios.infoPlist.UIFileSharingEnabled: true`（业务需要文件共享；与本修复无关，但属项目必需）
- 业务插件照常保留：`expo-asset / expo-font / expo-router / expo-splash-screen` 等，**不要删**。

---

## 四、不要照抄的坑（红鲱鱼，别当成"修复"带进新项目）

- ❌ **`withHermesFromSource`**：已删除，对 iOS 26 冷启无助且添乱。
- ❌ **`_layout.tsx` 里「覆盖 `Linking.getInitialURL` / `getLinkingURL` 返回 null」那段**：
  指向错模块（expo-linking 而非 expo-router 自己的 linking 层），**从未真正生效**。
  真修复是上面的 **scheme**，不要把它抄成"修复"。
- ❌ 别人草稿 app.json 里的 **`buildNumber:"80"`**：旧模板，企业签名覆盖安装需每次递增，别照抄固定值。
- ❌ 别因为看到"精简版 app.json 示例"就删插件：插件缺失会构建失败。以完整 `app.json` 为准。

---

## 五、可选：冷启动二分诊断系统（仅排查用）

`_layout.tsx` / `index.tsx` 里有 `EXPO_PUBLIC_DIAG` + `EXPO_PUBLIC_DIAG_STAGE` 分级开关。
**正常构建不设置这两个环境变量即关闭**，走业务全量路径。仅当再遇启动异常时，用它逐级二分定位。
给新项目输出时通常不需要，但可保留作为调试手段。

---

## 六、最小可复用 app.json 骨架（给新项目套用）

> 下方为含「必改项 + 保留项」的最小骨架，业务专属页面/插件按需替换。
> **注意**：JSON 不支持注释，写进 `app.json` 时去掉 `//` 注释行。

```json
{
  "expo": {
    "name": "YourApp",
    "slug": "yourapp",
    "scheme": "yourapp",                         // 必改项①：必须有自定义 scheme
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "buildNumber": "1",                        // 企业签名覆盖安装需每次 +1
      "bundleIdentifier": "com.yourapp.app",
      "infoPlist": { "UIFileSharingEnabled": true }
    },
    "plugins": [
      ["expo-router", { "root": "src/app" }],     // 必改项②：root 必须是 src/app
      "./plugins/crashReason/withCrashReason",    // 项目内自定义插件（路径按实际）
      "./plugins/turboModuleFix/withTurboModuleFix",
      "./plugins/withFmtConstevalFix",
      ["expo-build-properties", { "ios": { "buildReactNativeFromSource": true } }]
    ],
    "autolinking": {
      "ios": { "buildFromSource": ["react-native-reanimated", "react-native-worklets"] }
    },
    "extra": {
      "router": { "root": "src/app" }             // 必改项②：与插件 root 一致
    }
  }
}
```

---

## 七、构建验证清单

1. `eas build --platform ios --profile production --clear-cache`
   （中国大陆上传到 Google 存储易掉线 `socket hang up`，失败就重跑 / 换稳线路 / 换网络。）
2. 下载 IPA → 爱思助手装真机。
3. 验证通过标准：进首页、不卡启动图、不弹诊断窗、不出现 Unmatched Route 页、无 `[TurboModule:VOID]` 崩溃日志。
4. 企业签名覆盖安装：每次 `buildNumber` 需递增（如 88 → 89）。
