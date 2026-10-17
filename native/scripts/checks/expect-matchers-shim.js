/**
 * expect/build/matchers 兼容垫片（仅 check-local 的 jest 环境使用）
 * ============================================================
 * ★ 为什么需要它
 *   expo-router@55.0.5 的 testing-library/expect.js 引用
 *   `expect/build/matchers`，但项目实际安装的 expect@30.5.2 已移除该路径
 *   （build 目录下只剩 index.js）。修复它有两条路：
 *     ① 升级 expo-router 到 ~55.0.18（Metro 此前就提示版本不符）——
 *        属于动项目核心依赖，不在本校验方案的授权范围内，不做；
 *     ② 在 jest.check-local.config.mjs 里用 moduleNameMapper 把该路径
 *        指到本垫片——只影响 check-local 的 jest 环境，零副作用。
 *   本文件选 ②。
 *
 * ★ 契约（expo-router 期望的形状）
 *   · default.customTesters —— 对方模块加载时会赋值清空，给个可写属性即可；
 *   · default.toEqual(received, expected) —— 仅在调用 toHavePathname 等
 *     自定义匹配器时用到（本项目的 P5 测试不用它们，但保持可用）。
 */
"use strict";

const expectPkg = require("expect");
const expectFn = expectPkg.default ?? expectPkg.expect ?? expectPkg;

module.exports = {
  __esModule: true,
  default: {
    customTesters: [],
    toEqual: (received, expected) => expectFn(received).toEqual(expected),
  },
};
