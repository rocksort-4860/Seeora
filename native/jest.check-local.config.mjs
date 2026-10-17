/**
 * check-local 专用 jest 配置（P5 路由渲染冒烟）
 * ============================================================
 * ★ 为什么不复用 jest.config.mjs
 *   那个配置是 ts-jest + node 环境、roots 只含 src、testMatch 只含
 *   __tests__ 目录下的 .test.ts(x) 文件——它服务于「核心纯函数单测」。
 *   路由渲染需要完整 RN 运行时（jest-expo preset + react-test-renderer），
 *   与纯函数单测的环境互不兼容，因此单独立项，两套配置互不干扰。
 *
 * ★ 本配置只匹配 scripts/checks 目录下的 .test.tsx
 *   现有 `npm test`（jest.config.mjs）的范围完全不受影响；
 *   文件命名 *.test.tsx 只是为了让 .oxlintrc.json 的 jest env override
 *   覆盖到它（describe/it/expect 全局量），不进 __tests__ 目录。
 *
 * ★ 注释纪律（踩坑记录）：块注释里**绝不能出现「星号紧跟斜杠」的两字连写**——
 *   以两个星号开头的 glob 模式里就含这个序列，它会提前终结块注释，
 *   整份配置直接语法错误。本文只描述、不写示例。
 *
 * ★ 为什么必须写 roots（实测踩坑）
 *   不写 roots 时 jest-haste-map 会以 rootDir 为根爬进 node_modules/.pnpm
 *   存储，命中「Unexpected token '*'」SyntaxError。
 *
 * ★ 为什么要把 .mjs 也纳入 transform（本次关键修复）
 *   jest-expo 默认 transform 正则只覆盖 .js/.jsx/.ts/.tsx，不含 .mjs。
 *   而 lucide-react-native / @rn-primitives 等依赖的 ESM 产物是 .mjs，
 *   不被转换时 Node 在 require 阶段直接抛 "Must use import to load ES Module"。
 *   表现就是：凡用到这些图标的路由（(tabs)、today、settings…）在 jest 里
 *   渲染即崩，getPathname 永远停在 "/"，screen 永远查不到内容——
 *   那会让整套「渲染冒烟」变成永远红、毫无信号价值。
 *   修法：复用 jest-expo 自己的 babel 转换器（带 metro caller，能正确处理
 *   RN 平台别名），把 .mjs 也指过去；transformIgnorePatterns 维持原意
 *   （.pnpm / RN 系 / expo 系 不忽略），并补上 lucide 与 @rn-primitives。
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expoPreset = require("jest-expo/jest-preset");
// jest-expo 把 babel-jest 挂在 '\\.[jt]sx?$' 这个 key 上（见 jest-expo/jest-preset.js）
const babelTransform = expoPreset.transform["\\.[jt]sx?$"];

export default {
  preset: "jest-expo",
  roots: ["<rootDir>/scripts"],
  testMatch: ["**/scripts/checks/*.test.tsx"],
  transform: {
    ...expoPreset.transform,
    // 关键修复：ESM 依赖的 .mjs 也要走 babel 转 CJS，否则 require 阶段直接炸
    "\\.mjs$": babelTransform,
  },
  // 关键修复：jest 的 transformIgnorePatterns 是「任一匹配即忽略」的 OR 语义，
  // 因此必须把 lucide-react-native / @rn-primitives 加进**主** lookahead 的允许名单，
  // 单独再写一条「不匹配就不忽略」的兜底规则没用（主规则已经先命中并忽略了文件）。
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|lucide-react-native|@rn-primitives))/",
    "/node_modules/react-native-reanimated/plugin/",
  ],
  moduleNameMapper: {
    // expo-router@55.0.5 的 testing-library 引用 expect/build/matchers，
    // 而 expect@30 已移除该路径 —— 垫一个等价物（详见垫片文件头注释）
    "^expect/build/matchers$": "<rootDir>/scripts/checks/expect-matchers-shim.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
