/*
 * withExpoModulesCoreWerrorFix.js
 * ---------------------------------------------------------------------------
 * 修复 TestFlight 构建在 Xcode 26（Apple Clang 21）下失败的问题。
 *
 * 根因（2026-10-08 定位）：
 *   expo-modules-core/ios/Worklets/EXJavaScriptSerializable.mm 里的
 *   `toObjCValueType(worklets::Serializable::ValueType type)` 函数用一个 switch
 *   覆盖枚举的全部已知值，但没有 `default:` 分支。较新版本的 worklets 给该枚举新增了
 *   成员（ImportType / SynchronizableType / CustomType 等），导致 switch 不再「穷尽」；
 *   加上 expo-modules-core 的 podspec 通过 `pod_target_xcconfig` 给本 target 写死了
 *   `-Werror=return-type`，Apple Clang 21 于是把「并非所有控制流都返回值」判为硬错误：
 *     error: non-void function does not return a value in all control paths
 *            [-Werror,-Wreturn-type]
 *   （10/1 那次能过，是因为当时 worklets 枚举更少、switch 穷尽；之后升级即炸。）
 *
 * 为什么不是改编译参数：`-Werror=return-type` 写在 expo-modules-core 专属的 .xcconfig 里，
 *   post_install 改 build_settings 覆盖不到它（实测删 -Werror 的补丁对此 target 无效）。
 *   所以最稳的做法是直接修源码：给 switch 补一个 default 返回分支，让所有控制流都返回值，
 *   从根上消除该警告，与 Xcode 版本/编译参数无关。
 *
 * 实现：用 config plugin 的 withDangerousMod('ios') 在 EAS 云端 prebuild 阶段（node_modules
 *   已安装、编译尚未开始）改写该文件。幂等：已写入 MARKER 则跳过；锚点不匹配则告警跳过，
 *   绝不抛错中断构建（避免把构建卡在另一个错误上）。
 * ---------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '// Seeora: Xcode26 -Werror=return-type 兜底（default 分支）';

// 纯函数：尝试给 switch 补 default 分支。返回 true 表示确实改写了文件。供测试独立验证。
function patchExpoModulesCoreWerror(file) {
  if (!fs.existsSync(file)) {
    console.warn('[withExpoModulesCoreWerrorFix] 未找到文件，跳过：' + file);
    return false;
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    return false; // 已修补，幂等
  }
  // 锚点：switch 里最后一个 case（CustomType）到 switch/函数结束。缩进严格对齐源文件。
  const anchor =
    '    case worklets::Serializable::ValueType::CustomType:\n' +
    '      return EXSerializableValueTypeCustom;\n' +
    '  }\n' +
    '}';
  const replacement =
    '    case worklets::Serializable::ValueType::CustomType:\n' +
    '      return EXSerializableValueTypeCustom;\n' +
    '    default:\n' +
    '      return EXSerializableValueTypeUndefined; ' + MARKER + '\n' +
    '  }\n' +
    '}';
  if (!src.includes(anchor)) {
    console.warn(
      '[withExpoModulesCoreWerrorFix] 未匹配到 switch 锚点，可能 expo-modules-core 已更新，需人工复核：' + file
    );
    return false;
  }
  src = src.replace(anchor, replacement);
  fs.writeFileSync(file, src, 'utf8');
  console.log('[withExpoModulesCoreWerrorFix] 已修补：' + file);
  return true;
}

module.exports = function withExpoModulesCoreWerrorFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot =
        cfg.modRequest.projectRoot || path.dirname(cfg.modRequest.platformProjectRoot);
      const file = path.join(
        projectRoot,
        'node_modules',
        'expo-modules-core',
        'ios',
        'Worklets',
        'EXJavaScriptSerializable.mm'
      );
      patchExpoModulesCoreWerror(file);
      return cfg;
    },
  ]);
};

module.exports.patchExpoModulesCoreWerror = patchExpoModulesCoreWerror;
