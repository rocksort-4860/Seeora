/**
 * 左滑互斥总线（§M4）：打开新的行自动关闭旧的
 */
type Listener = (id: string | null) => void;

let openId: string | null = null;
const listeners = new Set<Listener>();

export function setOpenSwipe(id: string | null): void {
  openId = id;
  listeners.forEach((f) => f(id));
}

export function getOpenSwipe(): string | null {
  return openId;
}

export function onOpenSwipe(f: Listener): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
