/**
 * 工具函数：合并 Tailwind CSS 类名（clsx + tailwind-merge）
 * 用于 cn() 函数合并多个样式类名，解决冲突并去重
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
