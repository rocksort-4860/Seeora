/**
 * Pro 买断 / 支付 / 门禁（Seeora）：单商品「终身买断」
 * 从 store/app.tsx 拆出；行为对齐 Seeora 范式。价格一律动态（见 @/lib/iap）。
 *
 * 付费失败反馈模式来源：RockSort 已验证实现（922 工程）——
 *   · 失败**绝不静默**（用户/审核看到「点了没反应」= 风险 + 差评）；
 *   · 失败文案必须**回传**给弹层内联渲染，不能只 showToast：
 *     支付弹层是 RN 原生 Modal，全局 toast 渲染在它下面会被盖住，
 *     用户看到的就是「点了没反应、没有任何文字」。
 *   · ★ 因此失败路径**只**回传内联文案，**不再同时 showToast**：
 *     弹层内部已内嵌 <SheetToast>（读同一份 toastMsg），两处并存会让同一句话
 *     显示两遍（弹层底部胶囊 + 按钮上方各一行），看起来像渲染 bug。
 *     失败时弹层不会关闭，所以内联文案永远有地方显示，信息不会丢。
 *   · ★ 用户主动取消 ≠ 失败：取消不提示（见 purchasePlan 的三态结果）。
 */
import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Href } from "expo-router";
import { sset, SK } from "@/lib/storage";
import { fmt as fmtTpl, getDict, type Dict, type Lang } from "@/lib/i18n";
import { purchasePlan, restorePurchases, syncEntitlement, type PlanKey } from "@/lib/iap";

export interface ProNav {
  /** Href（非 string）：typed routes 生效后 router.push 只接受已知路由字面量 */
  push: (href: Href) => void;
  back: () => void;
}

export interface ProDeps {
  pro: boolean;
  purchased: boolean;
  setPurchased: Dispatch<SetStateAction<boolean>>;
  lang: Lang;
  dict: Dict;
  /** ms 可选：失败提示这类长文案需要更长的展示时间 */
  showToast: (msg: string, ok?: boolean, ms?: number) => void;
  setPayVisible: Dispatch<SetStateAction<boolean>>;
  nav: ProNav;
}

/** 恢复购买的细分级结果：供弹层内联渲染 + 语气分级（正常态 vs 真故障） */
export type PayRestoreOutcome = "ok" | "none" | "error" | "timeout" | "unconfigured";
export interface PayRestoreResult {
  ok: boolean;
  /** 失败原因的本地化文案（成功时为 null） */
  failText: string | null;
  outcome: PayRestoreOutcome;
}

/**
 * 进入买断页的「来源标记」，用于在 /pro 页顶部说明「你为什么被带到这里」。
 * 不加区分地推同一张页面，用户会疑惑（尤其从「习惯数量上限」这类业务边界触发时）。
 */
export type ProReason = "habitLimit" | "dataExport" | "shareTitle";

export function usePro(d: ProDeps) {
  const { pro, purchased, setPurchased, lang, dict, showToast, setPayVisible, nav } = d;
  const payPlan: PlanKey = "l"; // 唯一商品：终身买断

  // 连点防抖：push 是「新增一层」语义，600ms 内重复触发会叠出多层 /pro，
  // 用户要连按多次返回才回得到 Today。付费入口是高频误触点，必须挡住。
  const lastOpenRef = useRef(0);

  /* ===================== 权益核验（台账 A-05 / A6） =====================
   * 本项目原先「只信本地 {pro:true} 布尔，全项目 0 处 getCustomerInfo」。
   * 现在改为：**用户第一次触碰付费相关入口时**（打开买断页 / 触发付费门禁）
   * 与苹果侧核对一次，且整个 App 生命周期只跑一次。
   *   · active   → 补回本地丢失的凭证（重装后没点「恢复购买」也能自动找回）
   *   · inactive → 苹果侧**明确**回答「无本商品购买记录」才降级（伪造凭证）
   *   · unknown  → 不动作（网络/超时/未配 key 绝不等于未购买）
   * ★ 绝不放在冷启动：见 iap.syncEntitlement 的说明（会触碰到原生 TurboModule）。 */
  const syncedRef = useRef(false);
  const syncPurchaseState = useCallback(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      const r = await syncEntitlement();
      if (r === "active") {
        if (!purchased) {
          setPurchased(true);
          void sset(SK.receipt, { pro: true });
        }
        return;
      }
      if (r === "inactive" && purchased) {
        setPurchased(false);
        void sset(SK.receipt, { pro: false });
      }
    })();
  }, [purchased, setPurchased]);

  const openPro = useCallback((reason?: ProReason) => {
    syncPurchaseState(); // 与苹果侧核对权益（幂等，只跑一次）
    if (purchased) { showToast(getDict(lang).proOwned); return; } // 已买断 → 仅提示
    const now = Date.now();
    if (now - lastOpenRef.current < 600) return;
    lastOpenRef.current = now;
    nav.push(reason ? `/pro?from=${reason}` : "/pro"); // 以路由页呈现买断页
  }, [purchased, lang, showToast, nav, syncPurchaseState]);

  const closePro = useCallback(() => {
    nav.back();
  }, [nav]);
  const openPay = useCallback(() => setPayVisible(true), [setPayVisible]);
  const closePay = useCallback(() => setPayVisible(false), [setPayVisible]);

  /**
   * 发起购买。
   * 返回值：`null` = 已买断 / 购买成功 / **用户主动取消**（都不需要提示）；
   *        非空字符串 = 失败原因的本地化文案，由调用方内联渲染在弹层**内部**。
   */
  const payDone = useCallback(async (): Promise<string | null> => {
    if (purchased) { showToast(dict.proOwned); return null; }
    const outcome = await purchasePlan(payPlan);
    /* ★ 用户主动取消：不是错误，一个字都不提示。
     *   把他自己点的「取消」报成「购买未完成，请检查网络」，用户会以为付不了款；
     *   审核员测内购必然点一次取消，看到网络报错会判内购功能损坏（Guideline 2.1）。 */
    if (outcome === "cancelled") return null;
    /* ★ 失败同样只回传、不 showToast：弹层内已内嵌 SheetToast，
     *   再发一条会让同一句话在弹层里显示两遍（胶囊 + 按钮上方）。 */
    if (outcome === "failed") return dict.payBuyFail;
    // 成功：先关弹层再提示 —— 弹层关掉后全局 toast 才不被原生 Modal 盖住
    setPurchased(true);
    void sset(SK.receipt, { pro: true }); // 设备内购凭证缓存
    setPayVisible(false);
    showToast(dict.proOwned, true);
    return null;
  }, [purchased, payPlan, dict, showToast, setPurchased, setPayVisible]);

  /**
   * 恢复购买。
   * 返回值带 outcome，供调用方内联渲染 + 分级语气：
   *   · none  = 该账户确实没买过 —— **正常态**，不是故障（旧实现把它渲染成
   *             「无法恢复购买，请检查网络」，审核员据此判定恢复功能损坏，Guideline 2.1）
   *   · error / timeout = 真故障，需要用户处理
   */
  const payRestore = useCallback(async (): Promise<PayRestoreResult> => {
    const res = await restorePurchases();
    if (res.ok) {
      setPurchased(true);
      void sset(SK.receipt, { pro: true });
      /* ★ 成功即关闭支付弹层（对齐 RockSort 的 useRestoreAction(onClose)）：
       *   已解锁却把弹层留在原地，按钮仍写着「买断永久使用」，用户会以为恢复没生效、
       *   甚至再买一次。关闭后本页会显示「你已拥有永久版」，且全局 toast 才不被盖住。 */
      setPayVisible(false);
      showToast(lang === "zh" ? "已从本机恢复购买" : "Restored from this device", true);
      return { ok: true, failText: null, outcome: "ok" };
    }
    const outcome: PayRestoreOutcome =
      res.reason === "timeout" ? "timeout"
        : res.reason === "error" ? "error"
          : res.reason === "unconfigured" ? "unconfigured"
            : "none";
    /* 失败同样只回传内联（弹层内已有 SheetToast，再发一条会重复显示两遍）。
     * ★ unconfigured（无购买来源：未配 key / web）不能说成「检查网络」——
     *   那是让用户对着一个永远不会好的东西反复重试。改用「当前无法读取商品信息」。 */
    const text = outcome === "none" ? dict.payRestoreNone
      : outcome === "unconfigured" ? dict.payUnavailable
        : dict.payRestoreFail;
    return { ok: false, failText: text, outcome };
  }, [dict, lang, showToast, setPurchased, setPayVisible]);

  // 付费门禁：导出备份 / 分享成就卡 为买断权益
  // 统一走 openPro（同一入口 = 同一防抖 + 同一来源标记），避免两处各自 push 出不一致行为
  const gatePro = useCallback((labelKey: "dataExport" | "shareTitle"): boolean => {
    syncPurchaseState(); // 同 openPro：用户第一次碰付费入口时核验权益
    if (pro) return true;
    const need = lang === "zh" ? "需买断永久版" : "Lifetime buyout required";
    showToast(fmtTpl(dict[labelKey], {}) + " · " + need);
    openPro(labelKey);
    return false;
  }, [pro, dict, lang, showToast, openPro, syncPurchaseState]);

  return { payPlan, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro };
}
