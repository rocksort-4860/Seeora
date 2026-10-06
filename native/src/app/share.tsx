/**
 * Share 分享成就卡页（Seeora）：modal 路由 /share
 *  - 单个习惯成就卡 /share?habit=<id>：螺旋圆环 + 横向累计曲线 + 三宫格数据 + 备选文案 + 底部签名
 *  - 全站成就总卡 /share（无 habit 参数）：累计天数
 *  - 所有素材本机生成，不上传；无关联 App / 社交 / 评论
 *
 * ★★ 2026-10-06 重做：成就卡**必须能导出图片并调系统面板分享到其它 App**。
 *   旧实现只做 `Clipboard.setStringAsync(纯文本)` —— 屏幕上漂亮的卡片根本导不出图片，
 *   买断用户（「成就卡保存与分享」是买断权益之一）会直接判定权益缩水。
 *   新实现（与 RockSort 2026-10-03 的修复同源，真机验证过）：
 *     卡片整体用 react-native-svg 绘制 → `Svg.toDataURL(cb, {width, height})` 生成 PNG
 *     → ① 存相册（expo-media-library）② 系统分享面板（expo-sharing / RN Share）
 *   **不引入 react-native-view-shot**：社区原生模块，iOS 26 / Xcode 26 编译风险未验证。
 *
 * ★ 三条不能破：
 *   ① toDataURL 是**回调式实例方法**：`view.toDataURL(cb, opts)`，
 *      不是 `(Svg as any).toDataURL(ref, opts)`、更不是 Promise（await 只会拿到 undefined）。
 *   ② **不变式**：`options.width/height` == `<Svg>` 的 width/height == 渲染尺寸。
 *      三者不等 → viewBox 变换矩阵不是单位阵 → 导出图内容放大并裁掉右侧/底部
 *      （RockSort 真机实测放大 1.94~1.98 倍）。见 components/AchievementCard.tsx 文件头。
 *   ③ PNG 落盘必须走 `expo-file-system/legacy`：顶层 `expo-file-system` 的
 *      `writeAsStringAsync` 是**运行期直接 throw 的弃用壳**（会静默变成「保存失败」）。
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, TextInput, useWindowDimensions, View } from "react-native";
import Svg from "react-native-svg";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { X } from "lucide-react-native";
import { AchievementCard, CARD_H, CARD_W, type CardHabitData } from "@/components/AchievementCard";
import { useApp } from "@/store/app";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { appleElevation } from "@/lib/appleDesign";
import { describeError, formatCardDate, stripBase64 } from "@/lib/shareImage";

const QUOTES = ["quote1", "quote2", "quote3", "quote4"] as const;

/** 规范：全系统唯一一处投影，只给「落在台面上的产品」—— 成就卡就是那个产品 */
const productShadow = appleElevation.product;

/** 卡片容器左右留白（与 ScrollView 的 px-5 一致） */
const CARD_GUTTER = 40;
/** 卡片渲染宽度上限（pt）。导出像素 = 渲染 pt × 屏幕 scale(3x)，420pt → 约 1260px */
const CARD_MAX_W = 420;
const CARD_MIN_W = 260;

/** 导出超时：toDataURL 是原生回调，异常/未布局时可能永不回调（否则按钮永久转圈） */
const CAPTURE_TIMEOUT_MS = 8000;

export default function ShareScreen() {
  const { habit: habitId } = useLocalSearchParams<{ habit?: string }>();
  const { dict: d, colors: c, lang, closeShare, habits, importedTotalAll, streakOf, bestOf, nodesOf, curveOf, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const habit = habitId ? habits.find((h) => h.id === habitId) : undefined;
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [sign, setSign] = useState("");
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  /** 导出用的 SVG 实例（toDataURL 挂在其上，见文件头 ①） */
  const svgRef = useRef<Svg | null>(null);

  const realTotal = habits.reduce((acc, h) => acc + Object.keys(h.checkIns).length, 0);
  const imported = importedTotalAll();
  const total = realTotal + imported;

  /* —— 卡片渲染尺寸：宽度贴合容器，最大 420pt；高度按 viewBox 比例 ——
   * ★ 这两个数必须原样传给 toDataURL 的 options（不变式，见文件头 ②）。 */
  const cardW = useMemo(
    () => Math.min(Math.max(Math.round(winW) - CARD_GUTTER, CARD_MIN_W), CARD_MAX_W),
    [winW]
  );
  const cardH = useMemo(() => Math.round((cardW * CARD_H) / CARD_W), [cardW]);

  const headTitle = title.trim() || (habit ? (lang === "zh" ? habit.nameZh : habit.name) : lang === "zh" ? "我的坚持" : "My streak");
  const quote = d[QUOTES[quoteIdx]];
  const subtitle = formatCardDate(new Date(), lang);

  const habitData: CardHabitData | undefined = useMemo(() => {
    if (!habit) return undefined;
    const streak = streakOf(habit);
    return {
      nodes: nodesOf(habit, 14),
      curve: curveOf(habit, 45),
      streak,
      best: Math.max(bestOf(habit), streak),
      cycles: Object.keys(habit.checkIns).length,
    };
  }, [habit, streakOf, bestOf, nodesOf, curveOf]);

  /* ===================== 卡片 → PNG 文件 ===================== */
  /**
   * 生成 PNG 并落盘，返回可被相册 / 分享面板消费的 file:// uri。
   * 失败一律抛错，由调用方分场景给文案（不要在这里 showToast —— 调用方才知道是「保存」还是「分享」）。
   */
  const renderPng = useCallback(async (): Promise<string> => {
    const view = svgRef.current;
    // 编译期护栏：toDataURL 必须仍是「回调式实例方法」（见文件头 ①）
    if (!view || typeof view.toDataURL !== "function") throw new Error("svg-not-ready");

    const raw = await new Promise<string>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("toDataURL-timeout"));
      }, CAPTURE_TIMEOUT_MS);
      const finish = (b64: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(b64);
      };
      try {
        // options 的 width/height 必须等于 <Svg> 的渲染尺寸（不变式 ②）
        view.toDataURL(finish, { width: cardW, height: cardH });
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    });

    const base64 = stripBase64(raw);
    // iOS 的原生 base64 带换行、且**不带** data: 前缀（见 shareImage.stripBase64）
    if (!base64) throw new Error("empty-base64");

    /* ★ 必须用 legacy 子路径：顶层 export 的 writeAsStringAsync 是运行期 throw 的弃用壳 */
    const FS = await import("expo-file-system/legacy");
    const uri = `${FS.cacheDirectory ?? ""}seeora-card-${Date.now()}.png`;
    await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType.Base64 });
    return uri;
  }, [cardW, cardH]);

  /* ===================== 保存到相册 ===================== */
  const onSave = async () => {
    if (busy) return;
    setBusy("save");
    try {
      let uri: string;
      try {
        uri = await renderPng();
      } catch (e) {
        // Release 包没有 console：失败原因留个痕，别只暴露「失败」这个结论
        console.warn("[share] render failed:", describeError(e));
        showToast(d.shareImgFail, false, 2600);
        return;
      }
      /* web 无相册概念，退化成系统分享（含「存储图像」） */
      if (Platform.OS === "web") {
        await Share.share({ url: uri, title: "Seeora" });
        return;
      }
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (status !== MediaLibrary.PermissionStatus.GRANTED) {
          /* 未授权相册 ≠ 失败：退化为系统分享面板（面板里有「存储图像」），
           * 但必须**如实告知**为什么按钮跳到了分享面板，否则用户以为点错了。 */
          showToast(d.shareNoPerm, false, 3000);
          await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: d.shareTitle });
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        showToast(d.shareSavedImg, true);
      } catch (e) {
        console.warn("[share] save failed:", describeError(e));
        showToast(d.shareSaveFail, false, 2600);
      }
    } finally {
      setBusy(null);
    }
  };

  /* ===================== 调系统分享面板 ===================== */
  const onShare = async () => {
    if (busy) return;
    setBusy("share");
    try {
      let uri: string;
      try {
        uri = await renderPng();
      } catch (e) {
        console.warn("[share] render failed:", describeError(e));
        showToast(d.shareImgFail, false, 2600);
        return;
      }
      /* iOS 系统面板 → 可直接发到微信/微博/相册等。用户取消时 shareAsync 正常 resolve
       * （action='dismissed'），**不会**抛错，所以这里不提示取消；只有真故障才提示。 */
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: d.shareTitle });
      } else {
        await Share.share({ url: uri, title: "Seeora" });
      }
    } catch (e) {
      console.warn("[share] share failed:", describeError(e));
      showToast(d.shareShareFail, false, 2600);
    } finally {
      setBusy(null);
    }
  };

  const saveLabel = busy === "save" ? d.shareSaving : d.shareSave;
  const shareLabel = busy === "share" ? d.sharePreparing : d.shareShare;

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[24px] font-semibold" style={{ color: c.ink }}>
          {d.shareTitle}
        </Text>
        <Pressable
          onPress={closeShare}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: c.surface2 }}
          accessibilityLabel={d.close}
        >
          <Icon as={X} color={c.ink2} size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* 成就卡：白面 + 全系统唯一投影（规范里“落在台面上的产品”）。
            外层负责投影、内层负责裁圆角 —— 同一个 View 同时设 overflow:hidden 会把投影一起裁掉。
            ★ 卡片是 SVG，导出与预览共用同一棵树，所见即所得。 */}
        <View className="mt-2" style={{ ...productShadow, borderRadius: 24, backgroundColor: c.surface }}>
          <View style={{ borderRadius: 24, overflow: "hidden", alignItems: "center" }}>
            <AchievementCard
              lang={lang}
              dict={d}
              colors={c}
              title={headTitle}
              subtitle={subtitle}
              quote={quote}
              sign={sign}
              note={note}
              habit={habitData}
              total={total}
              width={cardW}
              height={cardH}
              svgRef={svgRef}
            />
          </View>
        </View>

        {/* 编辑 */}
        <View className="mt-4 gap-3">
          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
            <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
              {d.shareMainTitle}
            </T>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={d.shareMainTitle}
              placeholderTextColor={c.ink4}
              className="text-[17px]"
              style={{ color: c.ink }}
            />
          </View>

          {habit ? (
            <>
              <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
                <T className="mb-2 text-[12px] uppercase" style={{ color: c.ink4 }}>
                  {d.quoteLabel}
                </T>
                {QUOTES.map((q, i) => (
                  <Pressable
                    key={q}
                    onPress={() => setQuoteIdx(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: quoteIdx === i }}
                    className="flex-row items-center gap-2 py-1.5"
                  >
                    <View
                      className="h-4 w-4 rounded-full border"
                      style={{ borderColor: c.line2, backgroundColor: quoteIdx === i ? c.accent : "transparent" }}
                    />
                    <T className="text-[14px]" style={{ color: quoteIdx === i ? c.ink : c.ink4 }}>
                      {d[q]}
                    </T>
                  </Pressable>
                ))}
              </View>
              <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
                <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
                  {d.signLabel}
                </T>
                <TextInput
                  value={sign}
                  onChangeText={setSign}
                  placeholder={d.signLabel}
                  placeholderTextColor={c.ink4}
                  className="text-[17px]"
                  style={{ color: c.ink }}
                />
              </View>
            </>
          ) : null}

          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
            <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
              {d.shareNote}
            </T>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={d.shareNote}
              placeholderTextColor={c.ink4}
              className="text-[17px]"
              style={{ color: c.ink }}
              multiline
            />
          </View>
        </View>

        {/* 动作：规范按钮语法 —— 主 CTA = 行动色胶囊；次级 = 幽灵胶囊（透明底 + 1px 强调色描边） */}
        <View className="mt-5 gap-2">
          <Pressable
            onPress={() => { void onSave(); }}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busy }}
            className="w-full flex-row items-center justify-center gap-2 rounded-pill"
            style={{
              backgroundColor: c.accent,
              minHeight: 48,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy === "save" ? <ActivityIndicator color={c.inkInverse} size="small" /> : null}
            <Text className="text-[17px] font-semibold" style={{ color: c.inkInverse }}>
              {saveLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { void onShare(); }}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busy }}
            className="w-full flex-row items-center justify-center gap-2 rounded-pill border"
            style={{
              backgroundColor: "transparent",
              borderColor: c.accent,
              minHeight: 48,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy === "share" ? <ActivityIndicator color={c.accentText} size="small" /> : null}
            <Text className="text-[17px]" style={{ color: c.accentText }}>
              {shareLabel}
            </Text>
          </Pressable>
          {/* 卡片是图片不是文字：说明一句，避免用户以为「分享」还是复制文案 */}
          <T className="mt-1 text-center text-[12px]" style={{ color: c.ink4 }}>
            {lang === "zh" ? "卡片将保存为图片，可直接发到微信、微博等社交平台" : "Saved as an image — ready to post to any social app."}
          </T>
        </View>
      </ScrollView>
    </View>
  );
}
