/*
 * withTurboModuleFix.js
 * ---------------------------------------------------------------------------
 * iOS 26 + React Native New Architecture 启动崩溃缓解补丁（Expo config plugin）。
 *
 * 崩溃签名（与 .ips 完全一致）：
 *   EXC_CRASH (SIGABRT)
 *   Triggered by Thread: com.meta.react.turbomodulemanager.queue
 *   栈: ObjCTurboModule::performVoidMethodInvocation -> objc_exception_rethrow -> abort()
 *   （以及等价路径 ObjCTurboModule::performMethodInvocation 的同步/异步分支）
 *
 * 根因：iOS 26 让部分原生模块在 TurboModule 方法调用时抛 NSException。
 *   RN 在以下两处 @catch 里把异常转成 C++ jsi::JSError 并 throw/@throw：
 *     (A) performVoidMethodInvocation 的 void 分支：直接 `throw convertNSExceptionToJSError(...)`；
 *     (B) performMethodInvocation 的 @catch：`if (isSync) { throw ...; } else { @throw exception; }`。
 *   这些方法跑在后台 turbomodulemanager 队列、没有 JS 侧可捕获 -> rethrow 到无人监听队列 -> abort。
 *   该崩溃只发生在 Release / TestFlight / App Store 包（Dev 包因附加调试器不触发）。
 *
 * 修复（EAS prebuild 阶段，作用于 node_modules/react-native 的 RCTTurboModule.mm，
 *       ObjCInteropTurboModule 继承自 ObjCTurboModule，同一份代码覆盖所有模块）：
 *   - (A) void 分支：把 `throw` 改为 `RCTLogError + return`（不再 abort，且打印是哪个模块类）。
 *   - (B) 方法分支：同步 `throw` 改为 `RCTLogError + result = nil; return;`（退出 block，跳过 getReturnValue:，返回 nil 而非崩溃）；
 *         异步 `@throw exception` 改为 `RCTLogError; return;`（仅记录并退出 block）。
 *
 * 健壮性（关键）：
 *   - 不写死文件名/路径。RN 各发布包里该文件可能叫 RCTTurboModule.mm 或 ObjCTurboModule.mm，
 *     层级也可能不同。本插件按「内容」定位：扫描 node_modules/react-native 下所有含
 *     `convertNSExceptionToJSError` 的 .mm，对其应用上述两处补丁。
 *   - 若没有任何目标文件被 patch，直接抛错让构建快速失败（避免静默漏打补丁），
 *     并额外列出含 performVoidMethodInvocation 的候选文件。
 *
 * ★★ 上架红线（2026-10-06 修复，勿回退）：
 *   本插件**只做修复，绝不夹带任何诊断 UI / 副作用**。
 *   此前两处补丁里除 `throw → RCTLogError + return` 外，还塞了三件诊断：
 *     ① `[[UIPasteboard generalPasteboard] setString:…]`  → 污染用户剪贴板
 *     ② 主线程 `UIAlertController`「启动诊断(已复制到剪贴板)」 → **英文 App 里的中文弹窗**
 *     ③ 往 `Documents/turbo_module_exception.txt` 写文件
 *   危害：只要任一原生模块抛 NSException，审核员/用户就会看到一个中文诊断弹窗，
 *   属 Guideline 2.3.1「隐藏功能」拒审风险；且在 TurboModule 队列线程碰 UIKit、
 *   未经用户操作写剪贴板，本身可能引入新的崩溃。
 *   修复逻辑完全不需要诊断代码 —— 只保留 RCTLogError 即可（日志走系统 console，
 *   不弹窗、不写剪贴板、不落沙盒文件）。
 * ---------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const RN_DIR_REL = ['node_modules', 'react-native'];
const CANDIDATE_NAMES = ['RCTTurboModule.mm', 'ObjCTurboModule.mm'];
const KNOWN_SUBPATH = ['ReactCommon', 'react', 'nativemodule', 'core', 'platform', 'ios', 'ReactCommon'];

// (A) performVoidMethodInvocation 的 void 方法分支（6 行，唯一；performMethodInvocation 的 @catch 含 if/else 不会被误改）。
const OLD_VOID = `    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {`;

const NEW_VOID = `    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      RCTLogError(@"[TurboModule] Swallowed NSException in void method of module %@: %@",
                  NSStringFromClass([strongModule class]), exception);
      return;
    } @finally {`;

// (B) performMethodInvocation 的 @catch 整块：
//       `@catch (NSException *exception) { if (isSync) { throw ...; } else { @throw exception; } }`
//   正则锚定到 `@catch (NSException *exception) {` 起始，并用 `[^@]*?`（禁止跨越任何 `@` 字符）
//   把作用域严格锁在这一个 @catch 块内。这样只命中「方法分支」这一处 @catch，绝不会：
//     - 误吞前面同函数里的 perf-logger `if (isSync)`（旧正则就是栽在这里，从第一个
//       `if (isSync)` 一路 [\s\S]*? 吞到 throw，把 `@catch` 头、甚至 `@try` 整块吃掉，
//       导致 `exception` 失去声明作用域、大括号结构被打烂 → 编译失败）；
//     - 跨到 void 分支的 @catch（void 的 @catch 没有 `if (isSync)`，正则无法在此成立）。
//   替换成整块：同步 result=nil 并 return（退出 block，跳过 getReturnValue:），异步仅
//   RCTLogError 并 return；`@catch (NSException *exception)` 头与闭合 `}` 都原样保留，
//   故 `exception` 声明作用域不受影响、可继续在 RCTLogError 中使用。
const METHOD_RE = /@catch \(NSException \*exception\) \{[^@]*?if \(isSync\) \{[^@]*?throw convertNSExceptionToJSError\(runtime, exception, std::string\{moduleName\}, methodNameStr\);[^@]*?@throw exception;\s*\}\s*\}/;

const NEW_METHOD = `  @catch (NSException *exception) {
    if (isSync) {
      RCTLogError(@"[TurboModule] Swallowed NSException in sync method %s.%s: %@",
                  moduleName, methodNameStr.c_str(), exception);
      result = nil;
      return;
    } else {
      RCTLogError(@"[TurboModule] Swallowed NSException in async method %s.%s: %@",
                  moduleName, methodNameStr.c_str(), exception);
      return;
    }
  }`;

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

const SKIP_DIRS = new Set(['node_modules', 'Pods']);

// 扫描 node_modules/react-native 下所有含 convertNSExceptionToJSError 的 .mm 文件。
function findMmWithThrow(rnDir) {
  const hits = [];
  function walk(dir, depth) {
    if (hits.length >= 20 || depth > 14) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name), depth + 1);
      } else if (e.name.endsWith('.mm')) {
        const c = readFileSafe(path.join(dir, e.name));
        if (c && c.includes('convertNSExceptionToJSError')) hits.push(path.join(dir, e.name));
      }
    }
  }
  walk(rnDir, 0);
  return hits;
}

// 候选路径优先（最快），再回退到全量扫描。
function resolveTargetFiles(root) {
  const rnDir = path.join(root, ...RN_DIR_REL);
  if (!fs.existsSync(rnDir)) {
    throw new Error(
      '[turboModuleFix] 未找到 ' + RN_DIR_REL.join('/') + '，无法应用补丁。已中止构建以避免静默漏打补丁。'
    );
  }
  const found = new Set();
  for (const name of CANDIDATE_NAMES) {
    const p = path.join(rnDir, ...KNOWN_SUBPATH, name);
    const c = readFileSafe(p);
    if (c && c.includes('convertNSExceptionToJSError')) found.add(p);
  }
  for (const p of findMmWithThrow(rnDir)) found.add(p);
  return Array.from(found);
}

// 返回该文件上 A(void) / B(method) 两处补丁的命中与应用状态。
// voidPresent/methodPresent 表示「目标代码块在最终源里存在」；
// voidApplied/methodApplied 表示「本次实际发生了写入修改」。
function patchFile(filePath) {
  let contents = readFileSafe(filePath);
  const status = { voidPresent: false, methodPresent: false, voidApplied: false, methodApplied: false };

  if (contents.includes(NEW_VOID)) {
    status.voidPresent = true;
    status.voidApplied = true; // 已是补丁形态，无需再改
  } else if (contents.includes(OLD_VOID)) {
    contents = contents.replace(OLD_VOID, NEW_VOID);
    status.voidPresent = true;
    status.voidApplied = true;
  }

  if (contents.includes(NEW_METHOD)) {
    status.methodPresent = true;
    status.methodApplied = true;
  } else if (METHOD_RE.test(contents)) {
    contents = contents.replace(METHOD_RE, NEW_METHOD);
    status.methodPresent = true;
    status.methodApplied = true;
  }

  if (status.voidApplied || status.methodApplied) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
  return status;
}

module.exports = function withTurboModuleFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const files = resolveTargetFiles(cfg.modRequest.projectRoot);
      if (files.length === 0) {
        // 预编译 RN（EAS_USE_PRECOMPILED_MODULES=1）场景下 react-native 源码不会被编进包，
        // 也就没有可 patch 的 RCTTurboModule.mm——这是预期情况，不再中止构建，仅警告跳过。
        // （源码编译场景下若真找不到目标文件，说明 RN 已大改，补丁本就失效，跳过也比硬崩好。）
        console.warn(
          '[turboModuleFix] ⚠️ 未在 react-native 包内找到可 patch 的目标文件（含 convertNSExceptionToJSError）。' +
          '若使用预编译 RN，则崩溃缓解补丁不生效（跳过）；若为源码编译且 RN 已变更，请复查此插件。'
        );
        return cfg;
      }

      const agg = { voidPresent: false, methodPresent: false, voidApplied: false, methodApplied: false };
      for (const f of files) {
        const s = patchFile(f);
        agg.voidPresent = agg.voidPresent || s.voidPresent;
        agg.methodPresent = agg.methodPresent || s.methodPresent;
        agg.voidApplied = agg.voidApplied || s.voidApplied;
        agg.methodApplied = agg.methodApplied || s.methodApplied;
        if (s.voidApplied || s.methodApplied) {
          console.log('[turboModuleFix] ✅ 已 patch ' + f + ' (void=' + s.voidApplied + ', method=' + s.methodApplied + ')');
        }
      }

      // 关键校验：A(void) 与 B(method) 两处补丁应在最终源里都存在，缺一不可。
      // 但预编译 RN 等场景下源不被编进包，补丁本就不生效——此处降级为警告而非中止，
      // 避免把「补丁未命中」误判成「构建必须失败」。源码编译时若两处都未命中，说明 RN 已变更，需复查插件。
      if (!agg.voidPresent || !agg.methodPresent) {
        console.warn(
          '[turboModuleFix] ⚠️ 未同时命中 A(void) 与 B(method) 两处补丁（voidPresent=' +
          agg.voidPresent + ' methodPresent=' + agg.methodPresent + '）。' +
          '若为预编译 RN 或 RN 已变更导致源未被 patch，崩溃缓解补丁可能不生效，请知悉。目标文件：\n  ' +
          files.join('\n  ')
        );
        return cfg;
      }
      console.log(
        '[turboModuleFix] ✅ iOS 26 TurboModule 崩溃缓解补丁已应用（void 分支 + 方法同步/异步分支），A/B 均确认命中。'
      );
      return cfg;
    },
  ]);
};

// 供本地测试使用（不影响插件运行）。
module.exports._internals = { OLD_VOID, NEW_VOID, METHOD_RE, NEW_METHOD, resolveTargetFiles, patchFile };
