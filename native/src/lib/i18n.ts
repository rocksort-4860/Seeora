/**
 * i18n 文案表（Seeora）：中英一一对应，默认英文（en，出海优先）
 * 模板插值 {key}；t(k) 取 string；fmt(tpl, {n}) 替换
 */

export type Lang = "zh" | "en";

export interface Dict {
  brand: string; slogan: string;
  historyTitle: string; settingsTitle: string;
  tabHistory: string; tabToday: string; tabSettings: string;

  // Onboarding（3 张理念卡）
  ob1T: string; ob1B: string; ob2T: string; ob2B: string;
  ob3T: string; ob3B: string; obSkip: string; obDone: string;
  /* 中间页的「下一步」—— 此前 onboarding.tsx 把这句**硬编码**成
     `lang === "zh" ? "下一步" : "Next"`，而字典里那个 obStart 用的是无意义的 "OK"
     且全项目零引用。此处更名 obNext 并接回 UI，两边合一。 */
  obNext: string;

  // Today
  addHabit: string; addHabitHint: string; emptyTitle: string; emptySub: string;
  // （周目标达标整套已退役，相关 key 已移除）

  // Habit 表单
  habitAddTitle: string; habitEditTitle: string;
  fName: string; fNamePh: string; fDetail: string; fDetailPh: string;
  fEmoji: string; fColor: string;
  fFreq: string; fFreqPh: string; fTimes: string; fTimesPh: string;
  fReminder: string; fReminderOn: string; fReminderOff: string; fReminderTime: string;
  fMigrated: string; fMigratedDays: string; fMigratedStreak: string; fMigratedStart: string; fMigratedSource: string;

  // 通用
  save: string; cancel: string; delete: string; close: string;
  yes: string; no: string; confirmDelTitle: string; confirmDelBody: string;

  // 7 天补录
  backfillTitle: string; backfillSub: string; backfillLocked: string;

  // v0.2：周期节点 / 休息日 / 补签 / 仪式感
  restTitle: string; restAdd: string; restLocked: string; restToday: string;
  makeupTitle: string; makeupHint: string;
  ringHint: string; trendTitle: string;
  curStreak: string; bestStreak: string; cycles: string;
  nodeDays: string; newBest: string; achieve: string;

  // History
  totalCard: string; totalReal: string; totalImported: string;
  statTotal: string;
  hallOfFame: string; hallEmpty: string; addHonor: string;
  honorAddTitle: string; honorEditTitle: string;
  fHonorTitle: string; fHonorSource: string; fHonorDays: string; fHonorDetail: string; fHonorCategory: string;

  // 图表
  heatmap: string; heatmapEmpty: string; last8weeks: string;

  // Settings
  setGeneral: string; setLang: string; setTheme: string; setOnboarding: string;
  setNotif: string; setBadge: string;
  setDevice: string; setHaptics: string; setIcloud: string; setWeekStart: string;
  weekMon: string; weekSun: string;
  setExt: string; extHealth: string; extHealthSub: string; extSiri: string; extSiriSub: string; extWidget: string; extWidgetSub: string;
  setData: string; dataBuyout: string; dataExport: string; dataWipe: string;
  about: string; version: string; privacy: string; privacyText: string; localPromise: string;
  themeSystem: string; themeLight: string; themeDark: string;

  // Pro / Pay Sheet
  proTitle: string; proLifetime: string; proPermanent: string; proNoSub: string;
  proNoAccount: string; proDataYours: string; proBuy: string; proRestore: string;
  proRetry: string; proLoading: string; proOwned: string; payTitle: string; payStore: string;
  payUnavailable: string; buyoutTitle: string; buyoutBody: string;
  /* 试用改为**手动领取**（不再装完自动开启）：proTrialStart = 领取入口按钮文案 */
  proTrialLeft: string; proTrialOver: string; proTrialStart: string;
  habitLimitTitle: string; habitLimitBody: string; habitLimitToast: string;
  /* 试用结束后超限的习惯被冻结（数据保留、不可操作） */
  habitFrozen: string; habitFrozenTip: string; habitFrozenToast: string;
  /* 支付反馈（审核必点：任何失败路径都必须有可见提示，不能静默） */
  payBuyFail: string; payRestoreNone: string; payRestoreFail: string;
  /* 动作进行中文案（点下到 StoreKit 面板弹出之间有段空档，按钮不换字＝像「点了没反应」） */
  payProcessing: string; payRestoring: string;
  /* 习惯行当日打卡钮的 VoiceOver 标签（禁用裸英文 "check"/"undo"） */
  dCheckToday: string; dUndoToday: string;

  // Share Card
  shareTitle: string; shareMainTitle: string; shareNote: string; shareSave: string; shareShare: string;
  /* 成就卡导出图片：卡片用 SVG 绘制 → toDataURL 生成 PNG → 存相册 / 调系统分享面板 */
  shareSavedImg: string; shareSaveFail: string; shareImgFail: string; shareShareFail: string; shareNoPerm: string;
  shareSaving: string; sharePreparing: string;
  // v0.2 八：成就卡片备选文案与自定义签名
  quoteLabel: string; quote1: string; quote2: string; quote3: string; quote4: string; signLabel: string;

  // Export / Import / Wipe
  expCsv: string; expJson: string; impJson: string; expTitle: string;
  expOk: string; expFail: string; impOk: string; impEmpty: string; impFormat: string; impFail: string;
  wipeTitle: string; wipeBody: string; wipeConfirm: string; wipeCancel: string; wipeDone: string;

}

export const I18N: Record<Lang, Dict> = {
  zh: {
    brand: "Seeora", slogan: "记录习惯，允许休息，所有坚持永久留存",
    historyTitle: "历史", settingsTitle: "设置",
    tabHistory: "历史", tabToday: "今天", tabSettings: "设置",

    ob1T: "允许休息，不断连", ob1B: "漏签一天，连续不断；连续漏两天也只是暂停，不会归零。历史记录永久保存。",
    ob2T: "每圈 7 个点", ob2B: "圆环随坚持向外生长，相邻的日子会自动连成弧线。忘记打卡的部分只是底色，不评判。",
    ob3T: "一次性买断，永久使用", ob3B: "无订阅、无账号。一次付费，数据永远归你，本地存储，隐私无忧。",
    obSkip: "跳过", obDone: "开始使用", obNext: "下一步",

    addHabit: "添加习惯", addHabitHint: "例如：晨跑 · 阅读 · 冥想", emptyTitle: "还没有习惯", emptySub: "点击下方添加你的第一个习惯，开启无压力坚持。",
    // （周目标达标整套已退役，相关 key 已移除）

    habitAddTitle: "新建习惯", habitEditTitle: "编辑习惯",
    fName: "标题", fNamePh: "习惯名称", fDetail: "详情（可选）", fDetailPh: "补充说明",
    fEmoji: "图标", fColor: "主题色",
    fFreq: "每个节点代表天数", fFreqPh: "1~30，默认 1（每天一个点）", fTimes: "每个节点的打卡次数", fTimesPh: "1~20，默认 1（打满即实心）",
    fReminder: "每日提醒", fReminderOn: "已开启", fReminderOff: "已关闭", fReminderTime: "提醒时间",
    fMigrated: "从其它 App 导入的坚持", fMigratedDays: "导入总天数", fMigratedStreak: "当前连续", fMigratedStart: "开始日期", fMigratedSource: "来源",

    save: "保存", cancel: "取消", delete: "删除", close: "关闭",
    yes: "确定", no: "取消", confirmDelTitle: "删除习惯", confirmDelBody: "删除后该习惯的全部打卡记录将一并移除，且不可恢复。",

    backfillTitle: "补录打卡", backfillSub: "可对近 8 天补打或撤销；超过 7 天的日期已锁定。", backfillLocked: "已锁定",

    restTitle: "计划休息日", restAdd: "标记休息", restLocked: "过去的日期不能标记为休息日", restToday: "今天休息中",
    makeupTitle: "补签", makeupHint: "过去 7 天内可自由补签或取消，更早的日期已锁定。",
    ringHint: "每圈 7 个点，从你开始的那天算", trendTitle: "累计打卡曲线",
    curStreak: "当前连续", bestStreak: "最长连续", cycles: "累计打卡周期",
    nodeDays: "每个节点 {n} 天", newBest: "新的最长连续：{n}", achieve: "生成成就卡片",

    totalCard: "累计坚持天数", totalReal: "Seeora 内真实天数", totalImported: "导入天数",
    statTotal: "累计",
    hallOfFame: "荣誉室", hallEmpty: "还没有迁移来的历史成果，点击下方添加。", addHonor: "添加成果",
    honorAddTitle: "添加荣誉", honorEditTitle: "编辑荣誉",
    fHonorTitle: "标题", fHonorSource: "来源（如 App 名）", fHonorDays: "坚持天数", fHonorDetail: "详情（可选）", fHonorCategory: "分类（可选）",


    heatmap: "打卡热力图", heatmapEmpty: "还没有真实打卡记录。", last8weeks: "近 8 周",

    setGeneral: "通用", setLang: "语言", setTheme: "外观", setOnboarding: "重看引导",
    setNotif: "通知", setBadge: "应用角标",
    setDevice: "设备偏好", setHaptics: "触感反馈", setIcloud: "iCloud 同步", setWeekStart: "一周起始日",
    weekMon: "周一", weekSun: "周日",
    setExt: "扩展集成", extHealth: "Apple Health", extHealthSub: "只读摘要（即将支持）", extSiri: "Siri 与快捷指令", extSiriSub: "用语音打卡（即将支持）", extWidget: "主屏组件", extWidgetSub: "在桌面查看今日进度",
    setData: "数据安全", dataBuyout: "买断说明", dataExport: "导出备份", dataWipe: "抹掉数据",
    about: "关于", version: "版本 {v}", privacy: "隐私政策", privacyText: "Seeora 不收集任何个人数据。所有习惯、打卡与迁移记录仅存储于你的本机（或你自己的私有 iCloud），永远不会上传到我们的服务器。无账号、无追踪、无广告。", localPromise: "数据仅存于本机 / 私有 iCloud，永远归你。",
    themeSystem: "跟随系统", themeLight: "浅色", themeDark: "深色",

    proTitle: "永久买断", proLifetime: "Seeora 终身版", proPermanent: "一次付费，永久使用", proNoSub: "无订阅，无自动续费", proNoAccount: "无账号，无需注册", proDataYours: "数据归你，本地存储", proBuy: "买断永久使用", proRestore: "恢复购买", proRetry: "重试", proLoading: "价格加载中…", proOwned: "你已拥有永久版", payTitle: "买断 Seeora 终身版", payStore: "App Store", payUnavailable: "当前无法读取商品信息，请检查网络后重试。", buyoutTitle: "一次买断，永久属于你", buyoutBody: "支付后解锁全部数据权益：导出与导入备份、成就卡导出图片并分享到社交平台，以及未来所有功能更新。无订阅、无账号。", proTrialLeft: "免费试用中 · 剩 {n} 天", proTrialOver: "试用已结束，购买解锁永久版", proTrialStart: "开始 7 天免费试用", habitLimitTitle: "已达免费版上限 {n} 个习惯", habitLimitBody: "买断终身版即可解除数量限制，习惯数量永久不限。", habitLimitToast: "免费版最多 {n} 个习惯。买断后无限添加。", habitFrozen: "已冻结", habitFrozenTip: "免费版最多 {n} 个习惯可用。此习惯已冻结，你的记录完整保留；升级后可继续打卡。", habitFrozenToast: "此习惯已冻结。升级终身版后可继续打卡。", payBuyFail: "购买未完成。请检查网络或 App Store 付款设置后重试。", payRestoreNone: "本机没有找到可恢复的购买。如果用新设备登录，请先在同一 App Store 账号下购买。", payRestoreFail: "恢复购买失败，请检查网络连接后重试。", payProcessing: "处理中…", payRestoring: "正在恢复…", dCheckToday: "当日打卡", dUndoToday: "取消当日打卡",

    shareTitle: "分享成就", shareMainTitle: "自定义主标题", shareNote: "一句话备注（可选）", shareSave: "保存到相册", shareShare: "分享图片", shareSavedImg: "已保存到相册", shareSaveFail: "保存失败，请重试", shareImgFail: "生成图片失败，请重试", shareShareFail: "分享失败，请重试", shareNoPerm: "未获得相册权限，已改为打开分享面板", shareSaving: "正在保存…", sharePreparing: "正在生成…",
    quoteLabel: "备选文案", quote1: "越坚持，越成长", quote2: "越记录，越看见", quote3: "越沉淀，越发光", quote4: "越前行，越向好", signLabel: "底部签名（自定义一句话）",

    expCsv: "CSV", expJson: "JSON", impJson: "导入 JSON", expTitle: "导出 / 导入备份", expOk: "已导出备份", expFail: "导出失败，请重试", impOk: "已导入 {n} 条记录", impEmpty: "文件为空或不是有效的备份文件", impFormat: "文件格式不正确，请选择 Seeora 导出的 JSON 备份", impFail: "导入失败，请重试",
    wipeTitle: "抹掉所有数据", wipeBody: "此操作将永久删除全部习惯、打卡与荣誉记录，且无法恢复。请确认。", wipeConfirm: "确认抹掉", wipeCancel: "再想想", wipeDone: "已抹掉全部数据",

  },
  en: {
    brand: "Seeora", slogan: "Record habits. Rest is allowed. Every day stays.",
    historyTitle: "History", settingsTitle: "Settings",
    tabHistory: "History", tabToday: "Today", tabSettings: "Settings",

    ob1T: "Rest is allowed, streaks don't break", ob1B: "Miss one day and your streak keeps going. Two in a row only pauses it — nothing ever resets to zero.",
    ob2T: "7 nodes per loop", ob2B: "Your spiral grows outward as you keep going, and neighbouring days link up on their own. Forgotten days stay quiet grey — no scolding.",
    ob3T: "One-time buyout, forever", ob3B: "No subscription, no account. Pay once, your data is yours forever — stored locally, private by design.",
    obSkip: "Skip", obDone: "Get started", obNext: "Next",

    addHabit: "Add habit", addHabitHint: "e.g. Morning run · Reading · Meditation", emptyTitle: "No habits yet", emptySub: "Tap below to add your first habit and start stress-free.",
    // （周目标达标整套已退役，相关 key 已移除）

    habitAddTitle: "New habit", habitEditTitle: "Edit habit",
    fName: "Title", fNamePh: "Habit name", fDetail: "Detail (optional)", fDetailPh: "A short note",
    fEmoji: "Icon", fColor: "Theme color",
    fFreq: "Days per node", fFreqPh: "1~30, default 1 (one dot per day)", fTimes: "Check-ins per node", fTimesPh: "1~20, default 1 (any one fills it)",
    fReminder: "Daily reminder", fReminderOn: "On", fReminderOff: "Off", fReminderTime: "Reminder time",
    fMigrated: "Carried over from another app", fMigratedDays: "Total days", fMigratedStreak: "Current streak", fMigratedStart: "Start date", fMigratedSource: "Source",

    save: "Save", cancel: "Cancel", delete: "Delete", close: "Close",
    yes: "Confirm", no: "Cancel", confirmDelTitle: "Delete habit", confirmDelBody: "All check-ins for this habit will be removed too, and cannot be recovered.",

    backfillTitle: "Backfill check-ins", backfillSub: "Toggle any of the last 8 days. Dates older than 7 days are locked.", backfillLocked: "Locked",

    restTitle: "Rest day", restAdd: "Mark rest", restLocked: "Past dates can't be marked as rest", restToday: "Resting today",
    makeupTitle: "Backfill", makeupHint: "Free to backfill or undo within the last 7 days. Earlier dates are locked.",
    ringHint: "7 nodes per loop, counted from your first day", trendTitle: "Cumulative check-ins",
    curStreak: "Current streak", bestStreak: "Best streak", cycles: "Cycles completed",
    nodeDays: "1 node = {n} days", newBest: "New best streak: {n}", achieve: "Create achievement card",

    totalCard: "Total days", totalReal: "Real days in Seeora", totalImported: "Imported days",
    statTotal: "Total",
    hallOfFame: "Hall of Fame", hallEmpty: "No migrated history yet — add one below.", addHonor: "Add record",
    honorAddTitle: "Add honor", honorEditTitle: "Edit honor",
    fHonorTitle: "Title", fHonorSource: "Source (e.g. app name)", fHonorDays: "Days", fHonorDetail: "Detail (optional)", fHonorCategory: "Category (optional)",


    heatmap: "Check-in heatmap", heatmapEmpty: "No real check-ins yet.", last8weeks: "Last 8 weeks",

    setGeneral: "General", setLang: "Language", setTheme: "Appearance", setOnboarding: "Replay intro",
    setNotif: "Notifications", setBadge: "App badge",
    setDevice: "Device", setHaptics: "Haptics", setIcloud: "iCloud sync", setWeekStart: "Week starts on",
    weekMon: "Monday", weekSun: "Sunday",
    setExt: "Integrations", extHealth: "Apple Health", extHealthSub: "Read-only summary (soon)", extSiri: "Siri & Shortcuts", extSiriSub: "Check in by voice (soon)", extWidget: "Home widget", extWidgetSub: "See today's progress on your Home Screen",
    setData: "Data & safety", dataBuyout: "Buyout info", dataExport: "Export backup", dataWipe: "Erase data",
    about: "About", version: "Version {v}", privacy: "Privacy Policy", privacyText: "Seeora collects no personal data. All habits, check-ins and migrated records live only on your device (or your private iCloud) and are never uploaded to our servers. No account, no tracking, no ads.", localPromise: "Data stays on your device / private iCloud. Always yours.",
    themeSystem: "System", themeLight: "Light", themeDark: "Dark",

    proTitle: "Lifetime", proLifetime: "Seeora Lifetime", proPermanent: "Pay once, yours forever", proNoSub: "No subscription, no auto-renew", proNoAccount: "No account, no sign-up", proDataYours: "Your data, local only", proBuy: "Buy lifetime", proRestore: "Restore purchase", proRetry: "Retry", proLoading: "Loading price…", proOwned: "You own the lifetime edition", payTitle: "Buy Seeora Lifetime", payStore: "App Store", payUnavailable: "Couldn't load the product. Check your connection and retry.", buyoutTitle: "One buyout, forever yours", buyoutBody: "Unlock every data perk: export & import backups, achievement cards exported as images you can share anywhere, and all future updates. No subscription, no account.", proTrialLeft: "Free trial · {n} days left", proTrialOver: "Trial ended — buy to keep Pro", proTrialStart: "Start 7-day free trial", habitLimitTitle: "Free plan is full ({n} habits)", habitLimitBody: "Buy the lifetime edition to lift the cap — unlimited habits, forever.", habitLimitToast: "Free plan allows up to {n} habits. Buy to add unlimited.", habitFrozen: "Frozen", habitFrozenTip: "The free plan keeps up to {n} habits active. This one is frozen — your records are safe; unlock to check in again.", habitFrozenToast: "This habit is frozen. Unlock the lifetime edition to check in again.", payBuyFail: "Purchase didn't go through. Check your connection or App Store payment settings and try again.", payRestoreNone: "No purchase to restore on this device. If you're on a new device, buy again with the same App Store account.", payRestoreFail: "Couldn't restore the purchase. Check your connection and try again.", payProcessing: "Processing…", payRestoring: "Restoring…", dCheckToday: "Check in for today", dUndoToday: "Undo today's check-in",

    shareTitle: "Share achievement", shareMainTitle: "Custom title", shareNote: "One-line note (optional)", shareSave: "Save to Photos", shareShare: "Share image", shareSavedImg: "Saved to Photos", shareSaveFail: "Couldn't save the image. Try again.", shareImgFail: "Couldn't create the image. Try again.", shareShareFail: "Couldn't share. Try again.", shareNoPerm: "Photos access was denied — opening the share sheet instead.", shareSaving: "Saving…", sharePreparing: "Preparing…",
    quoteLabel: "Quote options", quote1: "The more you keep going, the more you grow", quote2: "The more you record, the more you see", quote3: "The more you settle, the brighter you shine", quote4: "The further you go, the better you feel", signLabel: "Signature line (custom)",

    expCsv: "CSV", expJson: "JSON", impJson: "Import JSON", expTitle: "Export / Import backup", expOk: "Backup exported", expFail: "Export failed. Try again.", impOk: "Imported {n} records", impEmpty: "File is empty or not a valid backup", impFormat: "Wrong format. Choose a Seeora JSON backup.", impFail: "Import failed. Try again.",
    wipeTitle: "Erase all data", wipeBody: "This permanently deletes every habit, check-in and honor record. This cannot be undone.", wipeConfirm: "Erase everything", wipeCancel: "Cancel", wipeDone: "All data erased",

  },
};

// 模板插值：{key} → 值
export function fmt(s: string, o: Record<string, string | number>): string {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? String(o[k]) : ""));
}

// 语言按钮显示当前语言的反义词
export function langBtnText(lang: Lang): string {
  return lang === "zh" ? "EN" : "中";
}

export function getDict(lang: Lang): Dict {
  return I18N[lang] || I18N.en;
}
