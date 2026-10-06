// fix: 核心纯函数单测配置（ts-jest，node 环境；@/ 路径别名映射到 src）
// ★ testMatch 必须同时含 .ts 与 .tsx —— 只写 "*.test.ts" 时，.tsx 测试文件**不会被匹配、
//   不会被执行，但 jest 仍然整体 PASS**（「测试假绿」：以为有覆盖，其实一条没跑）。
//   来源：RockSort 台账 G-08，该工程已修，本工程此前没继承。
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs", jsx: "react-jsx", esModuleInterop: true } }] },
};
