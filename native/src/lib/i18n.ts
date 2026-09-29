/**
 * i18n 文案表（Seeora）：中英一一对应，默认英文（en，出海优先）
 * 模板插值 {key}；t(k) 取 string；fmt(tpl, {n}) 替换
 */

export type Lang = "zh" | "en";

export interface Dict {
  brand: string; slogan: string;
  todayTitle: string; historyTitle: string; settingsTitle: string;
  tabHistory: string; tabToday: string; tabSettings: string;

  // Onboarding（3 张理念卡）
  obTitle: string; ob1T: string; ob1B: string; ob2T: string; ob2B: string;
  ob3T: string; ob3B: string; obSkip: string; obDone: string; obStart: string;

  // Today
  addHabit: string; addHabitHint: string; emptyTitle: string; emptySub: string;
  // （周目标达标整套已退役，相关 key 已移除）

  // Habit 表单
  habitAddTitle: string; habitEditTitle: string;
  fName: string; fNamePh: string; fDetail: string; fDetailPh: string;
  fEmoji: string; fColor: string; fWeeklyGoal: string;
  fFreq: string; fFreqPh: string; fTimes: string; fTimesPh: string;
  fReminder: string; fReminderOn: string; fReminderOff: string; fReminderTime: string;
  fMigrated: string; fMigratedDays: string; fMigratedStreak: string; fMigratedStart: string; fMigratedSource: string;

  // 通用
  save: string; cancel: string; delete: string; close: string;
  yes: string; no: string; confirmDelTitle: string; confirmDelBody: string;

  // 7 天补录
  backfillTitle: string; backfillSub: string; backfillLocked: string;

  // v0.2：周期节点 / 休息日 / 补签 / 仪式感
  restTitle: string; restAdd: string; restCancel: string; restLocked: string; restToday: string;
  makeupTitle: string; makeupHint: string;
  ringTitle: string; ringHint: string; trendTitle: string;
  curStreak: string; bestStreak: string; cycles: string;
  nodeDays: string; newBest: string; achieve: string;

  // History
  totalCard: string; totalReal: string; totalImported: string;
  statTotal: string; statReal: string; statImported: string;
  hallOfFame: string; hallEmpty: string; addHonor: string;
  honorAddTitle: string; honorEditTitle: string;
  fHonorTitle: string; fHonorSource: string; fHonorDays: string; fHonorDetail: string; fHonorCategory: string;

  // Leaderboard
  leaderboard: string; sortDays: string; sortName: string; sortCreated: string;
  badgeYear: string; badgeHalf: string; badgeQuarter: string; badgeMonth: string; badgeFresh: string;

  // 图表
  heatmap: string; heatmapEmpty: string; last8weeks: string;

  // Settings
  setGeneral: string; setLang: string; setTheme: string; setOnboarding: string;
  setNotif: string; setDailyReminder: string; setBadge: string;
  setDevice: string; setHaptics: string; setIcloud: string; setWeekStart: string;
  weekMon: string; weekSun: string;
  setExt: string; extHealth: string; extHealthSub: string; extSiri: string; extSiriSub: string; extWidget: string; extWidgetSub: string;
  setData: string; dataBuyout: string; dataExport: string; dataImport: string; dataWipe: string;
  about: string; version: string; privacy: string; privacyText: string; localPromise: string;
  themeSystem: string; themeLight: string; themeDark: string;

  // Pro / Pay Sheet
  proTitle: string; proLifetime: string; proPermanent: string; proNoSub: string;
  proNoAccount: string; proDataYours: string; proBuy: string; proRestore: string;
  proRetry: string; proLoading: string; proOwned: string; payTitle: string; payStore: string;
  payUnavailable: string; buyoutTitle: string; buyoutBody: string;
  proTrialLeft: string; proTrialOver: string;

  // Share Card
  shareTitle: string; shareMainTitle: string; shareNote: string; shareSave: string; shareShare: string; shareCopied: string;
  // v0.2 八：成就卡片备选文案与自定义签名
  quoteLabel: string; quote1: string; quote2: string; quote3: string; quote4: string; signLabel: string;

  // Export / Import / Wipe
  expCsv: string; expJson: string; impJson: string; expTitle: string;
  expOk: string; expFail: string; impOk: string; impEmpty: string; impFormat: string; impFail: string;
  wipeTitle: string; wipeBody: string; wipeConfirm: string; wipeCancel: string; wipeDone: string;

  errGeneric: string;
}

export const I18N: Record<Lang, Dict> = {
  zh: {
    brand: "Seeora", slogan: "记录习惯，允许休息，所有坚持永久留存",
    todayTitle: "今天", historyTitle: "历史", settingsTitle: "设置",
    tabHistory: "历史", tabToday: "今天", tabSettings: "设置",

    obTitle: "欢迎使用 Seeora",
    ob1T: "允许休息，不断连", ob1B: "漏签一天，连续不断；连续漏两天也只是暂停，不会归零。历史记录永久保存。",
    ob2T: "每圈 7 个点", ob2B: "圆环随坚持向外生长，相邻的日子会自动连成弧线。忘记打卡的部分只是底色，不评判。",
    ob3T: "一次性买断，永久使用", ob3B: "无订阅、无账号。一次付费，数据永远归你，本地存储，隐私无忧。",
    obSkip: "跳过", obDone: "开始使用", obStart: "OK",

    addHabit: "添加习惯", addHabitHint: "例如：晨跑 · 阅读 · 冥想", emptyTitle: "还没有习惯", emptySub: "点击下方添加你的第一个习惯，开启无压力坚持。",
    // （周目标达标整套已退役，相关 key 已移除）

    habitAddTitle: "新建习惯", habitEditTitle: "编辑习惯",
    fName: "标题", fNamePh: "习惯名称", fDetail: "详情（可选）", fDetailPh: "补充说明",
    fEmoji: "图标", fColor: "主题色", fWeeklyGoal: "每周目标天数",
    fFreq: "每个节点代表天数", fFreqPh: "1~30，默认 1（每天一个点）", fTimes: "每个节点的打卡次数", fTimesPh: "1~20，默认 1（打满即实心）",
    fReminder: "每日提醒", fReminderOn: "已开启", fReminderOff: "已关闭", fReminderTime: "提醒时间",
    fMigrated: "从其它 App 导入的坚持", fMigratedDays: "导入总天数", fMigratedStreak: "当前连续", fMigratedStart: "开始日期", fMigratedSource: "来源",

    save: "保存", cancel: "取消", delete: "删除", close: "关闭",
    yes: "确定", no: "取消", confirmDelTitle: "删除习惯", confirmDelBody: "删除后该习惯的全部打卡记录将一并移除，且不可恢复。",

    backfillTitle: "补录打卡", backfillSub: "可对近 8 天补打或撤销；超过 7 天的日期已锁定。", backfillLocked: "已锁定",

    restTitle: "计划休息日", restAdd: "标记休息", restCancel: "取消休息", restLocked: "过去的日期不能标记为休息日", restToday: "今天休息中",
    makeupTitle: "补签", makeupHint: "过去 7 天内可自由补签或取消，更早的日期已锁定。",
    ringTitle: "打卡圆环", ringHint: "每圈 7 个点，从你开始的那天算", trendTitle: "累计打卡曲线",
    curStreak: "当前连续", bestStreak: "最长连续", cycles: "累计打卡周期",
    nodeDays: "每个节点 {n} 天", newBest: "新的最长连续：{n}", achieve: "生成成就卡片",

    totalCard: "累计坚持天数", totalReal: "Seeora 内真实天数", totalImported: "导入天数",
    statTotal: "累计", statReal: "真实", statImported: "导入",
    hallOfFame: "荣誉室", hallEmpty: "还没有迁移来的历史成果，点击下方添加。", addHonor: "添加成果",
    honorAddTitle: "添加荣誉", honorEditTitle: "编辑荣誉",
    fHonorTitle: "标题", fHonorSource: "来源（如 App 名）", fHonorDays: "坚持天数", fHonorDetail: "详情（可选）", fHonorCategory: "分类（可选）",

    leaderboard: "排行榜", sortDays: "坚持天数", sortName: "名称", sortCreated: "创建时间",
    badgeYear: "≥1 年", badgeHalf: "≥半年", badgeQuarter: "≥3 月", badgeMonth: "≥1 月", badgeFresh: "1 月内",

    heatmap: "打卡热力图", heatmapEmpty: "还没有真实打卡记录。", last8weeks: "近 8 周",

    setGeneral: "通用", setLang: "语言", setTheme: "外观", setOnboarding: "重看引导",
    setNotif: "通知", setDailyReminder: "每日提醒", setBadge: "应用角标",
    setDevice: "设备偏好", setHaptics: "触感反馈", setIcloud: "iCloud 同步", setWeekStart: "一周起始日",
    weekMon: "周一", weekSun: "周日",
    setExt: "扩展集成", extHealth: "Apple Health", extHealthSub: "只读摘要（即将支持）", extSiri: "Siri 与快捷指令", extSiriSub: "用语音打卡（即将支持）", extWidget: "主屏组件", extWidgetSub: "在桌面查看今日进度",
    setData: "数据安全", dataBuyout: "买断说明", dataExport: "导出备份", dataImport: "导入备份", dataWipe: "抹掉数据",
    about: "关于", version: "版本 {v}", privacy: "隐私政策", privacyText: "Seeora 不收集任何个人数据。所有习惯、打卡与迁移记录仅存储于你的本机（或你自己的私有 iCloud），永远不会上传到我们的服务器。无账号、无追踪、无广告。", localPromise: "数据仅存于本机 / 私有 iCloud，永远归你。",
    themeSystem: "跟随系统", themeLight: "浅色", themeDark: "深色",

    proTitle: "永久买断", proLifetime: "Seeora 终身版", proPermanent: "一次付费，永久使用", proNoSub: "无订阅，无自动续费", proNoAccount: "无账号，无需注册", proDataYours: "数据归你，本地存储", proBuy: "买断永久使用", proRestore: "恢复购买", proRetry: "重试", proLoading: "价格加载中…", proOwned: "你已拥有永久版", payTitle: "买断 Seeora 终身版", payStore: "App Store", payUnavailable: "当前无法读取商品信息，请检查网络后重试。", buyoutTitle: "一次买断，永久属于你", buyoutBody: "支付后解锁全部数据权益：导出与导入备份、分享成就卡，以及未来所有功能更新。无订阅、无账号。", proTrialLeft: "免费试用中 · 剩 {n} 天", proTrialOver: "试用已结束，购买解锁永久版",

    shareTitle: "分享成就", shareMainTitle: "自定义主标题", shareNote: "一句话备注（可选）", shareSave: "保存", shareShare: "分享", shareCopied: "已复制",
    quoteLabel: "备选文案", quote1: "越坚持，越成长", quote2: "越记录，越看见", quote3: "越沉淀，越发光", quote4: "越前行，越向好", signLabel: "底部签名（自定义一句话）",

    expCsv: "CSV", expJson: "JSON", impJson: "导入 JSON", expTitle: "导出 / 导入备份", expOk: "已导出备份", expFail: "导出失败，请重试", impOk: "已导入 {n} 条记录", impEmpty: "文件为空或不是有效的备份文件", impFormat: "文件格式不正确，请选择 Seeora 导出的 JSON 备份", impFail: "导入失败，请重试",
    wipeTitle: "抹掉所有数据", wipeBody: "此操作将永久删除全部习惯、打卡与荣誉记录，且无法恢复。请确认。", wipeConfirm: "确认抹掉", wipeCancel: "再想想", wipeDone: "已抹掉全部数据",

    errGeneric: "出错了，请重试",
  },
  en: {
    brand: "Seeora", slogan: "Record habits. Rest is allowed. Every day stays.",
    todayTitle: "Today", historyTitle: "History", settingsTitle: "Settings",
    tabHistory: "History", tabToday: "Today", tabSettings: "Settings",

    obTitle: "Welcome to Seeora",
    ob1T: "Rest is allowed, streaks don't break", ob1B: "Miss one day and your streak keeps going. Two in a row only pauses it — nothing ever resets to zero.",
    ob2T: "7 nodes per loop", ob2B: "Your spiral grows outward as you keep going, and neighbouring days link up on their own. Forgotten days stay quiet grey — no scolding.",
    ob3T: "One-time buyout, forever", ob3B: "No subscription, no account. Pay once, your data is yours forever — stored locally, private by design.",
    obSkip: "Skip", obDone: "Get started", obStart: "OK",

    addHabit: "Add habit", addHabitHint: "e.g. Morning run · Reading · Meditation", emptyTitle: "No habits yet", emptySub: "Tap below to add your first habit and start stress-free.",
    // （周目标达标整套已退役，相关 key 已移除）

    habitAddTitle: "New habit", habitEditTitle: "Edit habit",
    fName: "Title", fNamePh: "Habit name", fDetail: "Detail (optional)", fDetailPh: "A short note",
    fEmoji: "Icon", fColor: "Theme color", fWeeklyGoal: "Weekly goal (days)",
    fFreq: "Days per node", fFreqPh: "1~30, default 1 (one dot per day)", fTimes: "Check-ins per node", fTimesPh: "1~20, default 1 (any one fills it)",
    fReminder: "Daily reminder", fReminderOn: "On", fReminderOff: "Off", fReminderTime: "Reminder time",
    fMigrated: "Carried over from another app", fMigratedDays: "Total days", fMigratedStreak: "Current streak", fMigratedStart: "Start date", fMigratedSource: "Source",

    save: "Save", cancel: "Cancel", delete: "Delete", close: "Close",
    yes: "Confirm", no: "Cancel", confirmDelTitle: "Delete habit", confirmDelBody: "All check-ins for this habit will be removed too, and cannot be recovered.",

    backfillTitle: "Backfill check-ins", backfillSub: "Toggle any of the last 8 days. Dates older than 7 days are locked.", backfillLocked: "Locked",

    restTitle: "Rest day", restAdd: "Mark rest", restCancel: "Unmark rest", restLocked: "Past dates can't be marked as rest", restToday: "Resting today",
    makeupTitle: "Backfill", makeupHint: "Free to backfill or undo within the last 7 days. Earlier dates are locked.",
    ringTitle: "Your spiral", ringHint: "7 nodes per loop, counted from your first day", trendTitle: "Cumulative check-ins",
    curStreak: "Current streak", bestStreak: "Best streak", cycles: "Cycles completed",
    nodeDays: "1 node = {n} days", newBest: "New best streak: {n}", achieve: "Create achievement card",

    totalCard: "Total days", totalReal: "Real days in Seeora", totalImported: "Imported days",
    statTotal: "Total", statReal: "Real", statImported: "Imported",
    hallOfFame: "Hall of Fame", hallEmpty: "No migrated history yet — add one below.", addHonor: "Add record",
    honorAddTitle: "Add honor", honorEditTitle: "Edit honor",
    fHonorTitle: "Title", fHonorSource: "Source (e.g. app name)", fHonorDays: "Days", fHonorDetail: "Detail (optional)", fHonorCategory: "Category (optional)",

    leaderboard: "Leaderboard", sortDays: "Days", sortName: "Name", sortCreated: "Created",
    badgeYear: "≥1yr", badgeHalf: "≥6mo", badgeQuarter: "≥3mo", badgeMonth: "≥1mo", badgeFresh: "<1mo",

    heatmap: "Check-in heatmap", heatmapEmpty: "No real check-ins yet.", last8weeks: "Last 8 weeks",

    setGeneral: "General", setLang: "Language", setTheme: "Appearance", setOnboarding: "Replay intro",
    setNotif: "Notifications", setDailyReminder: "Daily reminder", setBadge: "App badge",
    setDevice: "Device", setHaptics: "Haptics", setIcloud: "iCloud sync", setWeekStart: "Week starts on",
    weekMon: "Monday", weekSun: "Sunday",
    setExt: "Integrations", extHealth: "Apple Health", extHealthSub: "Read-only summary (soon)", extSiri: "Siri & Shortcuts", extSiriSub: "Check in by voice (soon)", extWidget: "Home widget", extWidgetSub: "See today's progress on your Home Screen",
    setData: "Data & safety", dataBuyout: "Buyout info", dataExport: "Export backup", dataImport: "Import backup", dataWipe: "Erase data",
    about: "About", version: "Version {v}", privacy: "Privacy Policy", privacyText: "Seeora collects no personal data. All habits, check-ins and migrated records live only on your device (or your private iCloud) and are never uploaded to our servers. No account, no tracking, no ads.", localPromise: "Data stays on your device / private iCloud. Always yours.",
    themeSystem: "System", themeLight: "Light", themeDark: "Dark",

    proTitle: "Lifetime", proLifetime: "Seeora Lifetime", proPermanent: "Pay once, yours forever", proNoSub: "No subscription, no auto-renew", proNoAccount: "No account, no sign-up", proDataYours: "Your data, local only", proBuy: "Buy lifetime", proRestore: "Restore purchase", proRetry: "Retry", proLoading: "Loading price…", proOwned: "You own the lifetime edition", payTitle: "Buy Seeora Lifetime", payStore: "App Store", payUnavailable: "Couldn't load the product. Check your connection and retry.", buyoutTitle: "One buyout, forever yours", buyoutBody: "Unlock every data perk: export & import backups, share achievement cards, and all future updates. No subscription, no account.", proTrialLeft: "Free trial · {n} days left", proTrialOver: "Trial ended — buy to keep Pro",

    shareTitle: "Share achievement", shareMainTitle: "Custom title", shareNote: "One-line note (optional)", shareSave: "Save", shareShare: "Share", shareCopied: "Copied",
    quoteLabel: "Quote options", quote1: "The more you keep going, the more you grow", quote2: "The more you record, the more you see", quote3: "The more you settle, the brighter you shine", quote4: "The further you go, the better you feel", signLabel: "Signature line (custom)",

    expCsv: "CSV", expJson: "JSON", impJson: "Import JSON", expTitle: "Export / Import backup", expOk: "Backup exported", expFail: "Export failed. Try again.", impOk: "Imported {n} records", impEmpty: "File is empty or not a valid backup", impFormat: "Wrong format. Choose a Seeora JSON backup.", impFail: "Import failed. Try again.",
    wipeTitle: "Erase all data", wipeBody: "This permanently deletes every habit, check-in and honor record. This cannot be undone.", wipeConfirm: "Erase everything", wipeCancel: "Cancel", wipeDone: "All data erased",

    errGeneric: "Something went wrong. Try again.",
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
