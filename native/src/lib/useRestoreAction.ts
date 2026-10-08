/**
 * 恢复购买统一动作（模仿 RockSort 最终定稿 922/src/lib/useRestoreAction.ts）
 * =============================================================================
 * 约定（对应 4 项 Restore 修复）：
 *   1. Loading  ：立即置灰 + 文案切「正在恢复…」，期间禁止重复点击
 *   2. 复位保证 ：`try / catch / finally` —— 无论成功、失败、还是抛异常，
 *                 回调结束必定 `setBusy(false)`，杜绝按钮永久卡死置灰
 *   3. 成功     ：仅关闭当前弹层并解锁 Pro（由调用方传入 closeOnSuccess）
 *   4. 失败     ：**绝不关闭弹层**，并把本地化失败文案经 `error` 交给弹层**内联**渲染
 *                 —— 不能只依赖全局 toast：调用方是原生 Modal 时 toast 会被它遮住
 *   5. 语气分级 ：`errorTone` 区分「正常态说明」与「真故障」——
 *                 outcome 为 none（该账户确实没买过）属**正常态**（info，中性色），
 *                 只有网络失败 / 超时 / 未配置才是需要用户处理的故障（danger，红色）。
 *                 一律涂红会把「这个账户没买过」渲染成像是功能坏了。
 *
 * 用法：
 *   const { busy, error, errorTone, run } = useRestoreAction(closeOnSuccess);
 *   <Pressable onPress={() => { void run(); }} disabled={busy}>…</Pressable>
 *   {error ? <Text style={errorTone === "danger" ? styles.err : styles.info}>{error}</Text> : null}
 */
import { useCallback, useRef, useState } from "react";
import { useApp } from "@/store/app";

export interface RestoreAction {
  /** 请求进行中：按钮置灰 + 文案切「正在恢复… / Restoring…」 */
  busy: boolean;
  /** 上一次恢复失败的本地化文案（空串 = 无错误），供弹层内联显示 */
  error: string;
  /** 提示语气：info = 正常态说明（没买过）；danger = 需要处理的故障 */
  errorTone: "info" | "danger";
  /** 执行一次恢复购买；返回是否成功（成功时已关闭当前弹层） */
  run: () => Promise<boolean>;
}

export function useRestoreAction(closeOnSuccess?: () => void): RestoreAction {
  const { payRestore, dict } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorTone, setErrorTone] = useState<"info" | "danger">("danger");
  /** 用 ref 同步 busy：闭包内读取最新值（避免同一回调里连点两次都放行） */
  const busyRef = useRef(false);

  const run = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false; // 进行中：忽略重复点击
    busyRef.current = true;
    setBusy(true);
    setError(""); // 新一轮开始先清掉上一次的失败原因
    let ok = false;
    // ★ 兜底文案必须在**进 try 之前**就填好：备用路径（payRestore 抛异常等）
    //   一旦命中，会静默退化成「无反馈」——而这正是本项目反复被拒审的形态。
    let failText: string | null = dict.payRestoreFail;
    let tone: "info" | "danger" = "danger";
    try {
      const r = await payRestore();
      ok = r.ok;
      failText = r.failText ?? dict.payRestoreFail; // 成功时为 null，下面 ok 分支不会用到
      // 「没买过」是正常态，不是错误 —— 不该用报警色渲染
      tone = r.outcome === "none" ? "info" : "danger";
    } catch {
      ok = false; // 兜底：异常同样走失败分支（不关闭弹层 + 本地化提示，绝不静默）
      failText = dict.payRestoreFail;
      tone = "danger";
    } finally {
      busyRef.current = false;
      setBusy(false); // 唯一复位点：任何分支都会经过
    }
    if (ok) closeOnSuccess?.();
    else {
      setError(failText ?? ""); // 失败：交给弹层内联渲染（failText 已保证非空）
      setErrorTone(tone);
    }
    return ok;
  }, [payRestore, dict, closeOnSuccess]);

  return { busy, error, errorTone, run };
}
