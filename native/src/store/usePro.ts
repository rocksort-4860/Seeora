/**
 * Pro 买断 / 支付 / 门禁（Seeora）：单商品「终身买断」
 * 从 store/app.tsx 拆出；行为对齐 Seeora 范式。价格一律动态（见 @/lib/iap）。
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sset, SK } from "@/lib/storage";
import { fmt as fmtTpl, getDict, type Dict, type Lang } from "@/lib/i18n";
import { purchasePlan, restorePurchases, type PlanKey } from "@/lib/iap";

export interface ProNav {
  push: (href: string) => void;
  back: () => void;
}

export interface ProDeps {
  pro: boolean;
  purchased: boolean;
  setPurchased: Dispatch<SetStateAction<boolean>>;
  lang: Lang;
  dict: Dict;
  showToast: (msg: string, ok?: boolean) => void;
  setProVisible: Dispatch<SetStateAction<boolean>>;
  setPayVisible: Dispatch<SetStateAction<boolean>>;
  nav: ProNav;
}

export function usePro(d: ProDeps) {
  const { pro, purchased, setPurchased, lang, dict, showToast, setProVisible, setPayVisible, nav } = d;
  const payPlan: PlanKey = "l"; // 唯一商品：终身买断

  const openPro = useCallback(() => {
    if (purchased) { showToast(getDict(lang).proOwned); return; } // 已买断 → 仅提示
    setProVisible(true);
    nav.push("/pro"); // 以 modal 路由呈现 Pay Sheet
  }, [purchased, lang, showToast, setProVisible, nav]);

  const closePro = useCallback(() => {
    setProVisible(false);
    nav.back();
  }, [setProVisible, nav]);
  const openPay = useCallback(() => setPayVisible(true), [setPayVisible]);
  const closePay = useCallback(() => setPayVisible(false), [setPayVisible]);

  const payDone = useCallback(async () => {
    if (purchased) { showToast(dict.proOwned); return; }
    const ok = await purchasePlan(payPlan);
    // 审核必点项：任何失败路径都必须给可见反馈，绝不能静默 return（用户点「买断」没反应 = 风险 + 差评）
    if (!ok) { showToast(dict.payBuyFail); return; }
    setPurchased(true);
    void sset(SK.receipt, { pro: true }); // 设备内购凭证缓存
    setPayVisible(false);
    setProVisible(false);
    showToast(dict.proOwned, true);
  }, [purchased, payPlan, dict, showToast, setPurchased, setPayVisible, setProVisible]);

  const payRestore = useCallback(async () => {
    const res = await restorePurchases();
    if (res.ok) {
      setPurchased(true);
      void sset(SK.receipt, { pro: true });
      showToast(lang === "zh" ? "已从本机恢复购买" : "Restored from this device", true);
      return;
    }
    // 以前这里弹 dict.proRestore（「恢复购买」按钮文案），把按钮当错误提示是错的。
    // 现在按原因分开：没买过 / 网络超时 / 其它错误，三套文案。
    if (res.reason === "timeout" || res.reason === "error") showToast(dict.payRestoreFail);
    else showToast(dict.payRestoreNone);
  }, [dict, lang, showToast, setPurchased]);

  // 付费门禁：导出备份 / 分享成就卡 为买断权益
  const gatePro = useCallback((labelKey: "dataExport" | "shareTitle"): boolean => {
    if (pro) return true;
    const need = lang === "zh" ? "需买断永久版" : "Lifetime buyout required";
    showToast(fmtTpl(dict[labelKey], {}) + " · " + need);
    setProVisible(true);
    nav.push("/pro");
    return false;
  }, [pro, dict, lang, showToast, setProVisible, nav]);

  return { payPlan, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro };
}
