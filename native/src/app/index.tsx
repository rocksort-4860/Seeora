/**
 * 根路由 `/`（2026-10-17 修复 Unmatched Route）：
 * 重写时把首页挪进了 (tabs) 分组，但 `(tabs)/today.tsx` 注册的是 `/today`，
 * 括号分组不进 URL —— 于是 `seeora://`（根路径 `/`）在路由表里没有任何页面对应，
 * 冷启动直接落到 expo-router 的 Unmatched Route 屏（TestFlight 实测）。
 * 这里补回根入口：把 `/` 重定向到默认 Tab（Today），不复制任何页面实现。
 */
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/today" />;
}
