/**
 * 弹层容器（来源：RockSort 已验证实现，922 工程移植到 Seeora）：
 * 移动端底部抽屉（圆角 24 顶、最大高 88%）、遮罩 rgba(16,24,40,.45) 淡入 250ms
 * center=true 时为居中对话框（Pay Sheet 用这个）。
 *
 * ★★ 铁律（勿破）：本文件用的是 RN 原生 <Modal>，它跑在**根视图之上**。
 *    因此有两条必须遵守的推论：
 *      ① 弹层内部的操作反馈**不能只靠全局 ToastHost** —— 那是根层的普通 View，
 *         会被整个盖住（渲染了、也播报了，屏幕上却没有）。所以这里内嵌 <SheetToast />。
 *      ② **绝不能给弹层再套一层 Modal**（不要嵌套 Modal）。RN 0.83 上嵌套 Modal
 *         会留下全屏透明 VC，关掉后整页失去响应（触摸被吃、不能滚动、返回键失效）。
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SheetToast } from "@/components/Toast";
import { type Colors, duration, fontSize, fontWeight, radius, spacing } from "@/lib/tokens";
import { useReduceMotion } from "@/lib/useReduceMotion";
import { announceSheet, claimSheet, releaseSheet, subscribeSheet } from "@/lib/sheetArbiter";
import { useApp } from "@/store/app";

/** 遮罩色：全项目统一 */
export const BACKDROP = "rgba(16,24,40,.45)";

/** 触控热区补足量：视觉 32pt 的 ✕ → 命中区 44pt */
const HIT = 6;

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** 点击遮罩是否可关（支付弹层不可关，避免误触丢单） */
  backdropClosable?: boolean;
  center?: boolean;
  children: React.ReactNode;
}

export function Sheet({ visible, onClose, backdropClosable = true, center = false, children }: SheetProps) {
  const { c, styles } = useStyles();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // 系统「减弱动态效果」开启时退化为瞬时切换（不做位移 / 缩放）
  const reduce = useReduceMotion();
  /* ★ 动画时长放进 ref，effect 的依赖里**只留 [visible, anim]**。
   *   为什么不能把 durIn / durOut 写进依赖：`reduce` 现在是**运行期可变**的
   *   （useReduceMotion 订阅了系统开关的变更事件），用户切换「减弱动态效果」的瞬间
   *   它就会变 → 由它派生的时长跟着变 → effect 重跑 → 正在播的入场/退场动画被打断
   *   并重播一次（视觉抖动）。时长只在「开始一次动画」那一刻需要，用 ref 读最新值即可。 */
  const durRef = useRef({ dIn: reduce ? 0 : duration.d2, dOut: reduce ? 0 : duration.d1 });
  useEffect(() => {
    durRef.current = { dIn: reduce ? 0 : duration.d2, dOut: reduce ? 0 : duration.d1 };
  }, [reduce]);
  /* 保留挂载直到退场动画播完（visible=false 不再立即 return null）。
   * ★ 初值必须是 false、由 effect 置 true：本工程多处弹层是「条件渲染 + visible 恒为 true」
   *   （ModalHost 里 return null 之后挂载），若初值取 visible，<Modal> 会在**首次 commit**
   *   就挂上去 —— 仲裁器的「延后一帧」就来不及生效，两个原生 Modal 仍然并存。
   *   取 false 不引入视觉差异：anim 初值本来就是 0（透明度 0），首帧本来就看不到内容。 */
  const [mounted, setMounted] = useState(false);
  /* 仲裁器代号：>0 表示本弹层的 <Modal> 正存活（详见 @/lib/sheetArbiter 文件头） */
  const tokenRef = useRef(0);

  /* ① 被后开的弹层顶替 → **立刻**卸载，不播退场动画。
   *    请勿改成「先播完退场动画再卸」：那 270ms 里两个原生 Modal 并存，
   *    RN 0.83 会因此留下全屏透明层，关掉后整页失去响应。 */
  useEffect(() => subscribeSheet((top) => {
    if (tokenRef.current && tokenRef.current !== top) {
      releaseSheet(tokenRef.current);
      tokenRef.current = 0;
      setMounted(false);
    }
  }), []);

  /* ② 组件整体卸载 → 归还代号（否则存活集合只增不减，后续每次开弹层都会被误判为「顶替」） */
  useEffect(() => () => { releaseSheet(tokenRef.current); tokenRef.current = 0; }, []);

  useEffect(() => {
    const { dOut } = durRef.current;
    if (visible) {
      /* ★ P1-9：重新打开时**先归还旧的代号，再 claim 新的**。
       *   泄漏路径：visible=false → 下面 else 分支安排 `setTimeout(… releaseSheet)`；
       *   若在这 300ms 内又被打开，effect 重跑会先跑上一次的 cleanup（clearTimeout）
       *   → 那次 release 被取消，而新的 claim 又把 tokenRef 覆盖成新值
       *   → 旧代号**永远留在存活集合里**，此后每次开弹层都被误判为「顶替」。
       * ★ ★ 归还必须放在**这里**（重新打开那一刻），绝不能放在 effect 顶部：
       *   放顶部的话，退场动画那 270ms 里本层代号就已归还 → alive 变空 →
       *   随后开的弹层 others=0、**不会延后挂载** → 两个原生 Modal 真的并存，
       *   正好破掉仲裁器要保的那条不变量（RN 0.83 上会留下全屏透明层，
       *   关掉后整页点不动）。正确时序：退场期间仍持有代号（新弹层会等我们让位），
       *   被重新打开时才立刻让位。 */
      if (tokenRef.current) { releaseSheet(tokenRef.current); tokenRef.current = 0; }
      const { token, others } = claimSheet();
      tokenRef.current = token; // ★ 先登记自己，再播报 —— 否则播报会把自己也卸掉
      announceSheet();
      const enter = () => {
        setMounted(true);
        Animated.timing(anim, { toValue: 1, duration: durRef.current.dIn, useNativeDriver: true }).start();
      };
      /* others > 0：正有弹层被顶替。延后一个宏任务挂载，
       * 确保对方（微任务里完成）的 Modal 已经卸载之后，才 present 本层。 */
      if (others > 0) {
        const t = setTimeout(enter, 0);
        return () => clearTimeout(t);
      }
      enter();
      return;
    }
    /* ★ 卸载必须由定时器兜底，绝不能只挂在动画完成回调上。
     * `start(cb)` 的 cb 在两种情况下拿不到 finished=true：
     *   ① 系统开启「减弱动态效果」时 dOut=0，零时长 + useNativeDriver 的回调不可靠；
     *   ② 快速连开连关导致 visible 连续变化，动画被后一次 effect 重跑中断，cb 收到 {finished:false}。
     * 一旦回调不执行，`if (finished)` 就不成立 → mounted 永远停在 true →
     * Modal 停在 visible=true，变成一个**看不见但全屏的触摸拦截层**：
     * 页面不能滚动、按钮点不动、导航返回键也失效（用户看到的就是「页面失去响应」）。 */
    const t = setTimeout(() => {
      setMounted(false);
      /* 归还仲裁代号：必须等 Modal 真的卸载了再还。
       * 这 270ms 内本层 Modal 确实还活着，期间若有新弹层打开，
       * 它会被正确判定为「顶替」（others > 0）并等我们让位。 */
      releaseSheet(tokenRef.current);
      tokenRef.current = 0;
    }, dOut + 120);
    Animated.timing(anim, { toValue: 0, duration: dOut, useNativeDriver: true }).start();
    return () => clearTimeout(t);
    // durRef 是 ref（引用恒定），不入依赖；时长在 effect 内读最新值。
  }, [visible, anim]);

  if (!mounted) return null;

  const sheetStyle = reduce
    ? { opacity: anim }
    : center
      ? { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }
      : { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }] };

  return (
    <Modal
      transparent
      visible={mounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 模态焦点陷阱：VoiceOver 焦点锁在弹层内，不穿透到背后列表。
       * pointerEvents 随 visible 收紧：退场（visible=false、mounted 尚未落）的那几帧里
       * 遮罩不再吃触摸，避免「关闭弹层后页面短暂/永久失去响应」。 */}
      <View
        style={[styles.mask, center && styles.maskCenter]}
        accessibilityViewIsModal
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={backdropClosable ? onClose : undefined}
          accessibilityRole={backdropClosable ? "button" : undefined}
          accessibilityLabel={backdropClosable ? "close" : undefined}
          accessibilityElementsHidden={!backdropClosable}
          importantForAccessibility={backdropClosable ? "yes" : "no-hide-descendants"}
        />
        <Animated.View
          style={[
            center ? styles.centerSheet : styles.sheet,
            !center && { paddingBottom: insets.bottom + spacing.s3 },
            sheetStyle,
          ]}
        >
          {children}
        </Animated.View>
        {/* ★ 弹层内的操作反馈必须在这里再渲染一份。
            全局 ToastHost 是根层的普通 View，会被这个原生 Modal 整片盖住 ——
            弹层里的提示（买断失败、恢复购买结果、「这是 Pro 功能」）都会变成
            「渲染了但看不见」。同一份 toastMsg 数据源、同一套定位，
            两处同时存在时完全重叠、视觉上仍是一个。 */}
        <SheetToast />
      </View>
    </Modal>
  );
}

/**
 * 弹层头部：标题 + ✕
 * closeLabel 走 i18n（无障碍朗读用）—— 不要留裸英文，中文用户 + 审核都会碰到。
 * icon 可选，用于「抹除数据」这类需要危险语义图标的确认框。
 */
export function SheetHeader({ title, onClose, closeLabel = "close", icon, closable = true }: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  icon?: React.ReactNode;
  /**
   * false = ✕ 置灰不可点（支付/恢复进行中）。
   * 为什么要这一档：✕ 与遮罩是两个**独立**的关闭入口（遮罩由 backdropClosable 控制），
   * 支付进行中放它仍可点，用户会以为「我取消掉了」，而 StoreKit 其实可能已经扣款
   * —— 轻则差评，重则退款投诉。
   * ★ 做法是**置灰保留占位**，不是隐藏：隐藏会让标题横向位移（justify-content:
   *   space-between），且下一个人很可能把「看不见」读成「没这个功能」；
   *   置灰同时给出可见的「此刻不可用」信号，避免变成「看得见却点了没反应」。
   */
  closable?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {icon}
        <Text maxFontSizeMultiplier={1.6} style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={closable ? onClose : undefined}
        disabled={!closable}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        accessibilityState={{ disabled: !closable }}
        hitSlop={HIT}
        style={[styles.xBtn, !closable && styles.xBtnOff]}
      >
        <Text style={styles.xTxt}>✕</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  mask: { flex: 1, backgroundColor: BACKDROP, justifyContent: "flex-end" },
  maskCenter: { justifyContent: "center", alignItems: "center", padding: spacing.s4 },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.r5, borderTopRightRadius: radius.r5,
    paddingHorizontal: spacing.s4, paddingTop: spacing.s3,
    maxHeight: "88%",
  },
  centerSheet: {
    backgroundColor: c.surface, borderRadius: radius.r5,
    padding: spacing.s4, width: "100%", maxWidth: 400,
    // 居中弹层：内容必须自己滚动（合规长文案 + 失败提示 + 按钮在小屏上会超过一屏）。
    // 这里给上限，超出的部分由内部 ScrollView 承担。
    maxHeight: "88%",
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.s3 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.s1, flexShrink: 1 },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: c.ink, flexShrink: 1 },
  xBtn: {
    width: 32, height: 32, borderRadius: radius.pill, backgroundColor: c.surface3,
    alignItems: "center", justifyContent: "center",
  },
  // ✕ 不可用时（支付/恢复进行中）：降低不透明度即「此刻不可点」，不隐藏以免标题位移
  xBtnOff: { opacity: 0.4 },
  xTxt: { fontSize: fontSize.cap, color: c.ink2 },
});

/** 主题化样式钩子：组件顶部 const { c, styles } = useStyles(); */
function useStyles() {
  const { colors: c } = useApp();
  return React.useMemo(() => ({ c, styles: makeStyles(c) }), [c]);
}
