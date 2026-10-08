/**
 * Pro 买断页（Seeora）：路由页 /pro
 * 由 usePro.openPro / gatePro 经 nav.push("/pro") 调起；关闭调用 closePro()
 * 价格动态读取（见 @/lib/iap），买断按钮展开 Pay Sheet（payVisible）
 *
 * 弹层模式来源：RockSort 已验证实现（922 工程）——四条不可破：
 *   ① 用自研 <Sheet>（RN 原生 Modal），**不用** rn-primitives Dialog：
 *      后者的 Overlay 在 iOS 上被 FullWindowOverlay 提升到**独立 UIWindow**，
 *      会把根层的全局 Toast 整片盖住 → 提示「渲染了但看不见」。
 *   ② 失败文案**内联渲染在弹层内部**（全局 Toast 同样会被弹层压住）。
 *      ★ 只走内联这一条路：弹层内已内嵌 SheetToast，若 store 再发一条全局 toast，
 *        同一句话会在弹层里显示两遍（底部胶囊 + 按钮上方各一行）。详见 usePro.ts。
 *   ③ 按钮进行中换文案 + `finally` 复位：杜绝「点了没反应」与永久灰态。
 *   ④ 支付/恢复**进行中不可关闭**：✕（SheetHeader closable）与安卓返回键（Sheet onClose）
 *      是两个独立入口，必须分别拦——它们都不受 backdropClosable 管辖。
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Check, Gem, X } from "lucide-react-native";
import { useApp } from "@/store/app";
import { usePlanPrices, priceLabel, hasRcKey } from "@/lib/iap";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { Text as T } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetHeader } from "@/components/Sheet";

export default function ProScreen() {
  const { dict: d, colors: c, purchased, trialActive, trialDaysLeft, trialUntil, startTrial, closePro, openPay, closePay, payVisible, payDone, payRestore } = useApp();
  const insets = useSafeAreaInsets();
  // 来源标记（openPro 推入时带的 query）：从「免费版习惯数达上限」进来的，
  // 必须在页面顶部说明原因，否则用户只看到一张买断页、不知道自己为什么被带到这里。
  const params = useLocalSearchParams();
  // ★ 必须叠加 !purchased：买断成功后本页会切到「你已拥有永久版」，
  //   此时若顶部还挂着「已达免费版上限」的横幅，页面前后自相矛盾。
  const fromHabitLimit = params.from === "habitLimit" && !purchased;

  /* 试用三态（单一数据源是 store 的 trialUntil，见 usePersist.ts）：
   *   fresh  — 从未领取 → 显示「开始 7 天免费试用」入口
   *   active — 进行中   → 显示剩余天数
   *   ended  — 已结束   → 显示「试用已结束」，且超限习惯被冻结
   * ★ 必须区分 fresh 与 ended：两者 trialActive 都是 false，
   *   若只判断 trialActive，从没领过试用的新用户会被写成「试用已结束」（事实错误，
   *   而且会让他以为「我的试用已经被人用掉了」，直接劝退）。 */
  const trialFresh = !purchased && trialUntil == null;
  const trialEnded = !purchased && trialUntil != null && !trialActive;
  /* ★ 价格位三态（与 iap.ts 的 ready 语义配套使用）：
   *   loading     弹层刚打开、尚未结束加载 → 显示「价格加载中…」，按钮暂不可提交
   *   ok          已拿到本地化价格        → 显示价格
   *   unavailable ★ 加载已结束但仍无价（Offering 漏挂商品 / priceString 为空 / 原生模块缺失）
   *               → 必须给出**可见原因 + 重试出路**。少了这一态，用户看到的是
   *                 永久转圈的「价格加载中…」+ 永久灰掉的买断按钮，没有任何自救可能
   *                 （Guideline 2.1：功能可见但永远不可用）。 */
  const [priceNonce, setPriceNonce] = useState(0); // 重试：自增即可重新拉取 Offerings
  const { prices, ready } = usePlanPrices(payVisible, priceNonce);
  const price = priceLabel(prices, "l", ready, d.proLoading);
  const priceUnavailable = hasRcKey() && ready && !prices.l;

  /* 两个动作各有独立的 loading 文案（买断显示「处理中…」、恢复显示「正在恢复…」），
   * 但**互斥性**由下面的 busy 统一约束：两者都会拉起 StoreKit，
   * 并发发起会被 SDK 以「已有交易在进行」拒绝，用户看到的就是莫名其妙的失败。
   * 所以买断按钮在恢复期间也置灰（最多 1~2 秒），换取「任一时刻只有一条购买流程」。 */
  const [paying, setPaying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // ★ 失败原因必须渲染在弹层**内部**：全局 toast 是根层普通 View，会被本弹层的原生 Modal 遮住。
  const [payErr, setPayErr] = useState("");
  const [restoreErr, setRestoreErr] = useState("");
  // 语气分级：「该账户没买过」是正常态，不该用报警色渲染（否则像功能坏了 → 审核误判）
  const [restoreTone, setRestoreTone] = useState<"info" | "danger">("danger");
  // 支付或恢复任一进行中：两者都会拉起 StoreKit，期间必须锁住所有关闭入口
  const busy = paying || restoring;
  // 买断按钮是否不可提交：进行中 / 另一条流程在跑 / 价格未就绪 / 已结束但读不到价
  // （三种「未就绪」都必须在界面上有可见原因，见下面 priceUnavailable 的渲染）
  const payBlocked = busy || !ready || priceUnavailable;

  /* ★ 弹层每次**打开**都清空上一次的失败文案。
   *   这里原先有一句错误注释（「本组件随 payVisible 卸载，重新进入时状态天然归零」）——
   *   不成立：本页是**路由页** /pro，payVisible 只控制它内部那个弹层，关弹层不会卸载页面。
   *   于是：买断失败 → 关弹层 → 再打开 → 上次那句「购买未完成」立刻自己冒出来，
   *   用户这次还什么都没点（审核员看到「一打开就报错」且无法消除，会判定购买功能损坏）。
   *   必须显式清。 */
  useEffect(() => {
    if (payVisible) { setPayErr(""); setRestoreErr(""); }
  }, [payVisible]);

  const benefits = [d.proPermanent, d.proNoSub, d.proNoAccount, d.proDataYours];

  const onPay = async () => {
    if (busy) return; // 另一条 StoreKit 流程还在跑：并发发起会被 SDK 直接拒掉
    setPaying(true);
    setPayErr(""); // 清掉上一次失败原因，避免误导
    try {
      // payDone 返回失败原因的本地化文案；null = 成功 / 已买断 / **用户主动取消**（都无需提示）。
      // 成功时 store 内部已关闭弹层，失败则留在原地把原因显示在按钮上方。
      const fail = await payDone();
      if (fail) setPayErr(fail);
    } catch {
      /* ★ 兜底：payDone 自身抛异常时不能什么都不显示。
       *   原实现只有 finally —— 一旦抛异常，按钮复位了、屏幕上却一个字都没有，
       *   用户看到的就是「点了没反应」，违反本项目「失败绝不静默」的铁律。
       *   （当前实现里 purchasePlan 内部已 try/catch，这条是防线不是活路。） */
      setPayErr(d.payBuyFail);
    } finally {
      // ★ 必须 finally 复位：payDone 一旦抛异常，按钮会永久停在 disabled 灰态，
      //   屏幕上既没有 loading、也没有提示 —— 用户看到的就是「点了没反应」。
      setPaying(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setRestoring(true);
    setRestoreErr("");
    try {
      const r = await payRestore();
      if (!r.ok) {
        setRestoreErr(r.failText ?? "");
        setRestoreTone(r.outcome === "none" ? "info" : "danger");
      }
    } catch {
      // 同上：异常路径也要有可见原因（恢复购买是审核必点项，更不能静默）
      setRestoreErr(d.payRestoreFail);
      setRestoreTone("danger");
    } finally {
      setRestoring(false); // 唯一复位点：成功/失败/抛异常都会经过
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[26px] font-extrabold tracking-tight" style={{ color: c.ink }}>{d.proTitle}</Text>
        <Pressable
          onPress={closePro}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: c.surface2 }}
          accessibilityLabel={d.close}
        >
          <Icon as={X} color={c.ink2} size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* 来源说明：从「免费版已满 5 个习惯」引导进来的，先讲清原因再讲权益 */}
        {fromHabitLimit ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-4 flex-row items-start gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.accentInk }}
          >
            <Icon as={Gem} color={c.accent} size={18} />
            <View className="flex-1">
              <T className="text-[15px] font-semibold" style={{ color: c.ink }}>
                {d.habitLimitTitle.replace("{n}", String(FREE_HABIT_LIMIT))}
              </T>
              <T className="mt-1 text-sm leading-5" style={{ color: c.ink2 }}>{d.habitLimitBody}</T>
            </View>
          </View>
        ) : null}

        <View className="mt-2 items-center py-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accentInk }}>
            <Icon as={Gem} color="#fff" size={30} />
          </View>
          <Text className="mt-3 text-[24px] font-extrabold" style={{ color: c.ink }}>{d.proLifetime}</Text>
          <T className="mt-1 text-sm" style={{ color: c.ink3 }}>{d.slogan}</T>
        </View>

        <View className="mt-3 gap-2.5">
          {benefits.map((b, i) => (
            <View key={i} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: c.surface2 }}>
                <Icon as={Check} color={c.accent} size={15} />
              </View>
              <T className="flex-1 text-[15px]" style={{ color: c.ink }}>{b}</T>
            </View>
          ))}
        </View>

        <T className="mt-4 text-sm leading-6" style={{ color: c.ink3 }}>{d.buyoutBody}</T>

        {purchased ? (
          <View className="mt-5 flex-row items-center justify-center gap-2 rounded-xl py-4" style={{ backgroundColor: c.surface }}>
            <Icon as={Check} color={c.success} size={18} />
            <T className="text-base font-semibold" style={{ color: c.success }}>{d.proOwned}</T>
          </View>
        ) : (
          <>
            {trialActive && (
              <View className="mt-5 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: c.surface }}>
                <Icon as={Gem} color={c.accent} size={16} />
                <T className="text-sm font-medium" style={{ color: c.ink }}>{d.proTrialLeft.replace("{n}", String(trialDaysLeft))}</T>
              </View>
            )}
            {/* 试用已结束（≠ 从未领取）：如实说明，紧接买断引导 */}
            {trialEnded && (
              <View className="mt-5 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: c.surface }}>
                <Icon as={Gem} color={c.ink3} size={16} />
                <T className="text-sm font-medium" style={{ color: c.ink2 }}>{d.proTrialOver}</T>
              </View>
            )}
            <Button
              className={trialActive || trialEnded ? "mt-3 h-14" : "mt-5 h-14"}
              style={{ backgroundColor: c.accentInk }}
              onPress={openPay}
            >
              <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.proBuy}</Text>
            </Button>
            {/* ★ 试用改为手动领取：只有「从未领取」才出现这个入口。
                用 outline 次要样式 —— 主 CTA 仍是买断（本页是买断页），
                同时给暂时不想付费的用户一条完整功能的低门槛路径。 */}
            {trialFresh && (
              <>
                <Button variant="outline" className="mt-2 h-14" onPress={startTrial}>
                  <Text className="text-base font-medium" style={{ color: c.ink }}>{d.proTrialStart}</Text>
                </Button>
                {/* ★ 2026-10-07 合规澄清：说明「体验 ≠ 订阅」——到期不会自动扣费，
                    想继续用才一次性买断（价格由后台商品提供，文案不硬编码）。 */}
                <T className="mt-2 text-center text-xs leading-5" style={{ color: c.ink3 }}>{d.proTrialNote}</T>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Pay Sheet：展开购买 / 恢复。★ 单层原生 Modal（绝不嵌套第二个 Modal） */}
      <Sheet
        visible={payVisible}
        /* ★ 安卓返回键（onRequestClose）走这条，不受 backdropClosable 管辖。
         *   支付中放它通过 = 用户以为取消了，而 StoreKit 可能已扣款。 */
        onClose={() => { if (busy) return; closePay(); }}
        center
        backdropClosable={!busy}
      >
        {/* closable={!busy}：✕ 是**另一个**独立关闭入口，必须单独拦（见 SheetHeader 注释） */}
        <SheetHeader
          title={d.payTitle}
          onClose={closePay}
          closeLabel={d.close}
          closable={!busy}
        />
        {/* ★ 必须可滚动：金额卡 + 支付方式 + 合规长文案 + 失败提示 + 按钮
            在 iPhone SE 一类小屏上会超过一屏。居中弹层有 maxHeight 88%，
            没有滚动容器时超出的部分会被推出屏幕外 —— 用户连买断按钮都看不到。
            SheetHeader 留在滚动区外，✕ 常驻可见（仅在支付/恢复进行中置灰，见 closable）。 */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
          <View className="items-center py-3" style={{ backgroundColor: c.accentWash, borderRadius: 16, marginBottom: 12 }}>
            {/* 价格是「文字」不是「块底色」：深色模式必须用 accentText（亮绿），
                用 accentInk（深绿）压在近黑背景上会掉到 3.2:1 不达 AA。
                三件套必须齐全（台账 D2）：numberOfLines + adjustsFontSizeToFit + minimumFontScale ——
                少了 minimumFontScale，后台改价后长文本只会被裁掉（用户看不到完整价格）。 */}
            <Text
              className="text-[40px] font-extrabold tabular-nums"
              style={{ color: c.accentText }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >{price}</Text>
          </View>

          {/* ★ 价格读不到时的可见原因 + 出路（不能只留一个转圈的占位符干等）。
              刻意**不显示价格、也不允许提交**，但必须让用户知道发生了什么、能做什么。
              文案用的是 i18n 里本就预留、此前从未被引用的 payUnavailable / proRetry。 */}
          {priceUnavailable ? (
            <View className="flex-row items-center justify-center gap-2" style={{ marginBottom: 10 }}>
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: c.danger, fontSize: 13, lineHeight: 20, flexShrink: 1 }}
              >
                {d.payUnavailable}
              </Text>
              <Pressable
                onPress={() => setPriceNonce((n) => n + 1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={d.proRetry}
              >
                <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "700" }}>{d.proRetry}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 支付方式：仅 App Store */}
          <View className="flex-row items-center gap-2 rounded-xl px-3 py-3" style={{ borderWidth: 1, borderColor: c.accentInk, marginBottom: 8 }}>
            <Text style={{ fontSize: 18 }}>🍎</Text>
            <T className="flex-1 text-sm font-medium" style={{ color: c.ink }}>{d.payStore}</T>
            <Text style={{ color: c.accentText, fontWeight: "700" }}>✓</Text>
          </View>

          <T className="text-xs leading-5" style={{ color: c.ink4 }}>{d.buyoutBody}</T>

          {/* 支付失败原因（内联可见，不依赖被弹层盖住的全局 toast） */}
          {payErr ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: c.danger, fontSize: 14, lineHeight: 24, textAlign: "center", marginTop: 8 }}
            >
              {payErr}
            </Text>
          ) : null}

          <Button
            className="mt-4 h-14 w-full"
            style={{ backgroundColor: c.accentInk, opacity: payBlocked ? 0.7 : 1 }}
            /* ★ 第二层保护：价格还没取到时不可提交订单（用户不该在没看到价格时下单）。
             *   这不是竞态修复的替代 —— 竞态已在 iap.ts 用 Promise 缓存根治（见该文件）。
             *   ★ 关键前提：`ready` 必须**保证会归位**（iap.ts 已改为无条件置 true，
             *     原先漏了「请求成功但 Offering 没挂商品」这第四条路）。
             *     归位之后，这里还要靠 `priceUnavailable` 兜住「已结束但读不到价」——
             *     少了它，第 ④ 条路同样会变成「可见但永远点不动」的灰按钮
             *     （Guideline 2.1），比原来的竞态更严重。 */
            disabled={payBlocked}
            onPress={() => { void onPay(); }}
          >
            {/* ★ 买断中必须换文案：点下到 StoreKit 面板弹出之间有一段空档，
                只把按钮变淡不换字，用户看到的就是「点了没反应」 */}
            <Text className="text-base font-bold" style={{ color: "#fff" }}>
              {paying ? d.payProcessing : d.proBuy}
            </Text>
          </Button>

          {/* 恢复购买结果（同样内联可见）。语气：没买过是正常态用中性色，真故障才涂红 */}
          {restoreErr ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: restoreTone === "info" ? c.ink3 : c.danger,
                fontSize: 13, lineHeight: 22, textAlign: "center", marginTop: 8,
              }}
            >
              {restoreErr}
            </Text>
          ) : null}

          <Button
            variant="outline"
            className="mt-2 h-11 w-full"
            style={{ opacity: busy ? 0.45 : 1 }}
            disabled={busy}
            onPress={() => { void onRestore(); }}
          >
            <Text className="text-base font-medium" style={{ color: c.ink }}>
              {restoring ? d.payRestoring : d.proRestore}
            </Text>
          </Button>
        </ScrollView>
      </Sheet>
    </View>
  );
}
