# Seeora · iOS 上架审核专家全量检查报告

> 检查时间：2026-10-11 ｜ 检查对象：`H:\习惯927`（目录已于 2026-10-12 更名为 `H:\seeora`；Expo + RN 工程 `native/`，版本 1.0.0 / build 10）
> 检查方式：静态代码审计（src 全量 85 文件）+ 构建配置核验 + 素材实测（截图逐张比对源码、静态页 URL 实测）+ 单测运行（81/81 通过）
> 风险等级定义：🔴 高风险 = 直接拒审项；🟡 中风险 = 高概率被拒或要求整改；🟢 低风险 = 建议优化

---

## ⚠️ 高风险项速览（提审前必须全部清零）

| # | 检查项 | 风险 | 一句话结论 |
|---|---|---|---|
| H1 | 隐私政策 / 支持 / 条款 URL | ✅ 已解决 | 仓库改名 Seeora 后新 URL 全部 200 可达（2026-10-11 实测），文档内链接已统一替换 |
| H2 | App 内隐私政策入口 | ✅ 已解决 | 2026-10-11「关于」页隐私政策行已接可点链接 `https://rocksort-4860.github.io/Seeora/privacy.html`（settings/about.tsx），tsc 通过 |
| H3 | 设置页「扩展集成」占位功能 | ✅ 已解决 | 2026-10-11 整组删除（settings + i18n ext* 键），tsc + 81 单测通过 |
| H4 | 商店截图与真实 App 严重不符 | ✅ 已解决 | 2026-10-11 用 expo export 静态导出真实页面重截完成，双尺寸产出：`商店截图_1206x2622/`（中屏，必需）+ `商店截图_1320x2868/`（大屏，Pro Max 原生）各 5 张，真实演示数据、真实 UI |
| H5 | 截图宣传不存在功能（Widgets / ADHD） | 🟠 修复中 | Widgets 转为真实功能：WidgetKit 扩展已开发（见 3.8）；ADHD 用户已拍板保留（标题 "Seeora: ADHD Habit Tracker"），按 2.9 口径准备答辩 |

---

## 一、App Store Connect 元信息 & ASO

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 1.1 App 名称 / 副标题 | 🟢 | 已定稿（2026-10-11）：名称 **"Seeora: ADHD Habit Tracker"**（26 字符），副标题 **"Gentle routines, no guilt"**（25 字符），均合规；注意 ADHD 宣称的 1.4.1 口径见 2.9 | 按定稿填入 ASC |
| 1.2 关键词字段（100 字符） | 🟢 | 已定稿：`streak,checkin,goal,productivity,planner,widget,offline,backfill,discipline,daily,rest,calm,focus`（97 字符），无竞品词、无重复 | 直接填入；"widget" 在小组件随本版上线后语义匹配 ✓ |
| 1.3 App 描述 | 🟡 | 尚未填写（待办） | 首段突出"本地优先 + 买断制 + 无账号"；不出现价格与外链；中英双语版本分别校对 |
| 1.4 截图尺寸 | 🟢 | 实测 5 张均为 **1206×2622**（6.3 英寸 iPhone 16 Pro 规格，ASC 合规尺寸）。注意：目录名误标为 `1290x2796`，ASC 清单文档写的是"6.7 英寸"——三处口径不一致 | 尺寸本身无需改；上传时选 6.3" 分组；修正目录名与文档口径，避免传错分组被 ASC 拒收 |
| 1.5 截图内容真实性 | 🔴 **高** | **截图与真实 App 严重不符**：① 截图 1/3 底部 tab 为「Habits / Honors」，真实 App 为「今天 / 历史 / 设置」三 tab（`tabToday/tabHistory/tabSettings`）；② 截图 3 展示"成就徽章解锁网格"（First step / Week one / unlocked / Total checks），源码中**零匹配**，真实 HonorRoom 仅是迁移历史列表；③ 截图 5 付费页为"Unlock Seeora Pro + Buy now · $4.99 硬编码价格 + Privacy/Terms 链接"布局，真实 `pro.tsx` 为"终身版 + 动态价格 + 手动领取试用"，完全不同；④ 截图 4 大标题宣传 "Widgets, offline"，App 无 Widget 功能（设置页仅为占位） | **用真实 Release/TestFlight 包重截全部 5 张**。截图必须展示审核版本的真实 UI。当前这套图提交 = Guideline 2.3.3（截图不准确）几乎必拒 |
| 1.6 预览视频 | 🟢 | 未制作（非必需） | 可不做；若做，不得出现外部网站跳转 |
| 1.7 分级年龄 | 🟢 | 无 UGC、无敏感内容，ASC 清单建议 4+，合理 | 问卷全选"无/否"，结果 4+ ✓ |
| 1.8 版权 / 支持网址 / 隐私政策链接 | 🟢 ~~🔴~~ **已解决** | 仓库由 Streakora 改名为 Seeora，2026-10-11 实测 `https://rocksort-4860.github.io/Seeora/` 及 `/privacy.html` `/terms.html` `/support.html` `/landing.html` **全部 200 可达**。项目文档内旧链接已统一替换为新域名 | 填入 ASC：Privacy Policy URL = `.../Seeora/privacy.html`，Support URL = `.../Seeora/support.html`；提审前再用手机浏览器复核一次。版权 © 2026 张新华 ✓ |
| 1.9 版本更新日志 | 🟢 | 首版 1.0.0，无需更新日志 | 后续版本写具体改动，禁"修复 bug"模糊话术 |
| 1.10 多语言元数据 | 🟡 | App 内中英双语完整 ✓；商店元数据（描述/关键词/截图文案）目前截图仅英文 | 上架地区若含中文区，补齐中文元数据；机器翻译需人工校对 |

## 二、隐私 & 合规（驳回重灾区）

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 2.1 隐私政策网页内容 | 🟡 | 本地 `静态网页/privacy.html` 存在且中英双语、已填实开发者身份；内容与代码行为一致（本地存储 + RevenueCat 购买数据）。但**线上 404**（见 1.8） | 恢复线上访问后复核内容：已含 RevenueCat 数据说明 ✓、无 IDFA ✓、支持海外访问（GitHub Pages 海外可达性好）✓ |
| 2.2 App 隐私清单 Privacy Manifest | 🟡 | 工程内未见 App 级 `PrivacyInfo.xcprivacy`；Expo SDK 55 核心与部分模块自带声明，但 AsyncStorage（UserDefaults）、FileSystem（文件时间戳/磁盘空间）等 Required Reason API 依赖 SDK 侧覆盖，未逐一验证 | EAS prebuild 后在 Xcode 工程确认隐私清单存在且覆盖：UserDefaults、file timestamp、disk space、system boot time 四类 Required Reason；缺失则添加 App 级 `PrivacyInfo.xcprivacy` |
| 2.3 权限弹窗 Purpose String | 🟢 | 相册权限文案中英双语完整（`expo-media-library` 插件配置 ✓）；通知权限在"首次添加带提醒任务时"才请求，拒绝后静默降级不崩溃 ✓；保存图片被拒后降级为分享面板并提示 ✓；无摄像头/麦克风/通讯录/剪贴板权限 | 无需修改 |
| 2.4 IAP 内购合规 | 🟢 | 买断制单商品 `seeora_pro_lifetime`，全部走 RevenueCat/StoreKit；无任何微信/支付宝/外部网页付费入口（全源码零匹配）✓；代码零硬编码价格（动态读取后台）✓；**恢复购买**双入口（设置页 + 付费弹层）✓；用户取消 vs 真失败三态区分 ✓；8 秒超时不永久转圈 ✓；无价时可见原因 + 重试 ✓ | 保持。⚠️ 持续确认生产构建**绝不设置** `EXPO_PUBLIC_DEMO_IAP=1`（演示态会绕过 StoreKit 直接解锁 = 拒审+下架级问题）。当前 `eas.json` production 未设置 ✓ |
| 2.5 账号注销 | 🟢 | App 无账号体系（本地优先、无注册），苹果"账号删除"条款不适用；提供「抹掉所有数据」功能（二次确认 + 全量清空 + 角标清零）✓ | 无需修改 |
| 2.6 禁止内容 | 🟢 | 无色情/暴力/赌博；无绕过苹果逻辑；无服务器远程开关隐藏功能（全部功能本机可见） | ⚠️ 注意 1.5 的反向问题：截图不得展示不存在功能 |
| 2.7 Apple 登录 | 🟢 | 无任何第三方登录 → 不强制提供 Sign in with Apple | 无需修改 |
| 2.8 ASC App 隐私问卷 | 🟡 | ASC 清单已给出与代码一致的填写指引（仅勾 Purchases→Purchase History，关联身份 No，追踪 No） | 按清单第 4 步填写；确保问卷 ↔ 隐私政策 ↔ 代码三方一致 |
| 2.9 医疗宣称（ADHD） | 🟡 | 截图 1 顶部 "ADHD HABIT TRACKER"、标题 "A habit tracker for ADHD minds"。类目申报为"健康健美"，ADHD 属医疗/心理健康宣称，Guideline 1.4.1 敏感区（可能要求提供医疗依据或改文案） | 建议软化为 "ADHD-friendly" / "for easily distracted minds"，或准备答辩口径（自我提升工具、不做诊疗宣称）；不做医疗功效承诺 |

## 三、产品功能自测

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 3.1 主流程完整 | 🟢 | 启动 → 引导（可跳过）→ 习惯 CRUD → 打卡/补签/休息日 → 荣誉室 → 导出/导入 → 付费/恢复，链路完整；81/81 单测通过 | TestFlight 真机再走一遍全流程 |
| 3.2 弱网场景 | 🟢 | 核心功能全本地存储，不依赖网络；IAP 有 8s 硬超时 + 失败可见原因 + 重试，断网不崩溃 | 真机飞行模式验证付费页提示 |
| 3.3 异常输入 | 🟢 | 导入 JSON 有格式校验 + 二次确认；习惯名/备注有表单约束；单测覆盖 i18n/逻辑 | 真机补测超长文本、emoji、特殊符号 |
| 3.4 账号场景 | 🟢 | 无账号体系，不适用 | — |
| 3.5 深色模式 | 🟢 | `userInterfaceStyle: automatic` + 主题三档（跟随系统/浅色/深色）；付费页价格色专门做过深色对比度处理 | TestFlight 真机逐页目检深色 |
| 3.6 最低 iOS 版本 | 🟢 | Expo SDK 55 / RN 0.83，最低 iOS 15.1+；历史专项修复过 iOS 26 启动崩溃（turboModuleFix 等 4 个补丁插件 + 白屏核验包文档） | 用最低版本设备 + iOS 26 真机各跑一次冷启动回归 |
| 3.7 屏幕适配 | 🟢 | SafeArea 全量使用；付费弹层对小屏（SE）有滚动容器处理 | 真机验证 SE / Pro Max 两极端 |
| 3.8 未完成功能 | 🟢 ~~🔴~~ **已解决** | 「扩展集成」占位组已删除（2026-10-11）；**主屏小组件转为真实功能并已开发**：WidgetKit 扩展（`targets/widget/index.swift`，小/中两种尺寸，今日进度环 + 习惯列表）+ App Group 数据桥（`modules/widget-sync`）+ App 侧快照同步（`src/lib/widgetSync.ts`，habits/语言变化即推送）。Apple Health / Siri 不做 | 小组件需经 EAS Build（含 prebuild）验证：扩展 target 生成、App Group 双向读写、打卡后时间线刷新。提审版本不得再出现任何"即将支持"文案 |
| 3.9 iPad 适配 | 🟢 ~~🟡~~ **已解决** | 已拍板不做 iPad：`supportsTablet` 已改 `false`（2026-10-11），下次构建生效 | 无需 iPad 截图；构建后在 ASC 确认设备家族仅 iPhone |

## 四、性能 & 稳定性

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 4.1 冷/热启动 | 🟡 | RevenueCat / 通知均懒加载，冷启动不触碰原生 TurboModule（针对 iOS 26 崩溃的专项设计）；曾发白屏问题并有三轮交叉核验文档 | TestFlight 实测冷启动 < 3s、无白屏；iOS 26 真机必测 |
| 4.2 内存泄漏 | 🟢 | 静态无法完全验证；store 用 useCallback 规范，无明显泄漏模式 | 长时挂机 + Xcode Instruments 抽查 |
| 4.3 后台行为 | 🟢 | 无 `UIBackgroundModes` 声明，无后台定位/麦克风；仅本地通知，合规 | 无需修改 |
| 4.4 崩溃 | 🟢 | 全局错误边界（诊断构建专属）；81 单测通过；历史崩溃链路（TurboModule）已专项修复 | TestFlight 收集崩溃日志回归 |
| 4.5 电量 | 🟢 | 无持续定位/后台任务，本地应用低功耗 | 无需修改 |

## 五、打包 & 构建

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 5.1 版本号 / Build 号 | 🟢 | version 1.0.0 + buildNumber 10 + EAS `autoIncrement: true`，不会重复提交 | 无需修改 |
| 5.2 Bundle ID 一致性 | 🟡 | 工程 `com.seeora.app`、ASC App ID `6816858218`、EAS projectId 均已配置；ASC 后台 Bundle ID 无法从本地核验 | 提审前人工核对 ASC 后台 Bundle ID 与 `app.json` 一字不差（历史审计反复强调的最易错点） |
| 5.3 Release 生产包 | 🟢 | EAS production profile 远程凭证 + `credentialsSource: remote` ✓ | 提交前确认 archive 为 production profile 产物 |
| 5.4 调试代码移除 | 🟢 | 全源码无 `console.log`；诊断浮层/错误边界均受 `EXPO_PUBLIC_TM_SURFACE=1` 门控，生产构建未设置该变量 → 摇树剔除零字节；`EXPO_PUBLIC_DIAG` 同理 | 保持；打生产包时确认 env 只含 `EXPO_PUBLIC_REVENUECAT_IOS_KEY` |
| 5.5 推送通知 | 🟢 | 仅本地通知（无远程推送），无推送证书问题；权限拒绝降级正常 | 无需修改 |
| 5.6 出口合规 | 🟢 | `ITSAppUsesNonExemptEncryption: false` 已声明 | 无需修改 |
| 5.7 UIFileSharingEnabled | 🟢→🟡 | `UIFileSharingEnabled: true` 已开启，但未在文档中找到业务用途（导出走的是系统分享面板，不依赖文件共享） | 无明确用途建议关闭（置 false），避免审核问询；若保留，准备用途说明 |
| 5.8 敏感凭据管理 | 🟡 | ① 项目根目录明文存放 `SubscriptionKey_2T478PJ2X3.p8`（App Store Connect API 私钥）；② `eas.json` 含 RevenueCat 公钥（可公开，无风险）和 appleId 邮箱（非机密） | 若该目录会进 git/网盘/分享，立即移出 .p8 并考虑吊销换发；.p8 泄露可被冒用操作 ASC |

## 六、Apple Ads & ASO 投放前置

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 6.1 Apple Ads 开通条件 | 🟢 | Bundle ID 规范、IAP 合规，上架后满足开通条件 | 无需修改 |
| 6.2 广告关键词与功能语义匹配 | 🟡 | 当前截图/元数据若含 ADHD、Widgets 等词，与 App 实际功能不匹配（功能未实现 / 宣称待软化） | 先完成 1.5/2.9/3.8 修复，再定关键词；广告素材必须展示真实功能 |
| 6.3 SKAdNetwork / 归因 | 🟢 | 未配置 SKAdNetwork（无广告 SDK） | 投放 Apple Ads 时再按当时方案配置；不投可不管 |
| 6.4 "下载我们 App" 类文案 | 🟢 | 全源码无此类文案 | 无需修改 |

## 七、审核风险专项

| 检查项 | 风险等级 | 现状 | 修复建议 |
|---|---|---|---|
| 7.1 网页套壳 | 🟢 | 独立 Expo + RN 原生工程（本地存储、本地通知、原生 IAP、成就卡图片生成），非 H5 套壳；仓库里的 `静态网页/` 是营销/法务页，与 App 本体无关 | 无需修改 |
| 7.2 隐藏功能 | 🟢 | 无服务器开关、无审核模式；所有功能审核版本可见 | 无需修改（反向问题见 3.8：不可见功能不得宣传） |
| 7.3 审核测试账号 | 🟢 | 无需登录，ASC 清单已注明"不需要演示账号" | 审核备注按 ASC 清单第 8 步模板填写（无登录、买断制非订阅、试用手动领取不扣费、数据本机、RevenueCat） |
| 7.4 系统修改 | 🟢 | 无篡改系统行为；`LSApplicationQueriesSchemes` 仅 mailto | 无需修改 |
| 7.5 内购商品后台配置 | 🟡 | 代码只认 `seeora_pro_lifetime` + Entitlement `seeora_pro`（正确设计，拒绝兜底商品）；但 ASC/RC 后台商品是否已建、已挂 Offering、状态"准备提交"无法本地核验 | 按 ASC 清单第 5 步逐项打卡：商品创建 → 本地化信息 → 内购审核截图（用真实付费页截图）→ RC Offering 挂商品 → 随版本一起提审 |
| 7.6 iOS 26 启动崩溃史 | 🟡 | 本项目有 iOS 26 Release 包冷启动 SIGABRT 历史（已有 4 个补丁插件 + 诊断构建机制 + 三版白屏核验包） | 提审包必须在 iOS 26 真机做冷启动 ×10 回归；确认 4 个补丁插件在 production 构建全部生效 |

---

## 修复优先级路线图

**P0（不修必拒，按序执行）**
1. ~~恢复四个静态页线上访问~~ ✅ 已完成（仓库改名 Seeora，新 URL 全部可达）；~~App 内「关于」页接可点链接~~ ✅ 已完成（H2，2026-10-11）
2. 删除设置页「扩展集成」占位组（H3）
3. ~~用真实 App 重截全部商店截图（H4/H5）~~ ✅ 已完成（2026-10-11：expo export 静态导出 + 无头 Edge，双尺寸 5 张；注：expo start 开发服 lazy 分包在本环境挂空，截图流水线固定走静态导出，见 `_shot_real.js` 头注）

**P1（高概率整改）**
4. iPad 策略二选一（3.9）
5. 核实/补充 PrivacyInfo.xcprivacy（2.2）
6. ADHD 宣称软化（2.9）
7. ASC/RC 后台商品配置核验（7.5）
8. iOS 26 真机冷启动回归（7.6）

**P2（提审前收尾）**
9. 元数据填写：关键词 / 描述 / 宣传文本（1.2/1.3）
10. 关闭或说明 UIFileSharingEnabled（5.7）
11. 移出 .p8 私钥（5.8）
12. TestFlight 全机型回归（深色/弱网/SE/Pro Max）
