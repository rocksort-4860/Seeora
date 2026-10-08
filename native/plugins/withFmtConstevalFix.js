/*
 * withFmtConstevalFix.js
 * ---------------------------------------------------------------------------
 * 配套 buildReactNativeFromSource=true 的必要兜底（RN 源码编译）。
 *
 * 0) Xcode 26 严格 Clang 兜底（2026-10-08 新增，修复 TestFlight 构建失败）
 *    EAS 镜像锁定 macos-sequoia-15.6-xcode-26.2 后，Apple Clang 把大量历史警告升级为
 *    硬错误，最典型的是：
 *      error: non-void function does not return a value in all control paths
 *             [-Werror,-Wreturn-type]
 *    这些警告来自第三方 / RN 自带原生代码（RN 0.83.2 的 C++/ObjC 源、vendored 的 fmt 等
 *    C++ 库），在旧 Xcode 只是警告、在新 Xcode 26 直接编译失败。（10/1 那次能过，是因为
 *    当时 EAS 镜像更松。）标准救法：把所有 Pods target 的
 *    `GCC_TREAT_WARNINGS_AS_ERRORS` 设为 NO，让这些历史警告恢复成「仅警告」。这不影响我们
 *    自己的 App 代码（App target 不在此列），也不改变任何运行时行为，仅放开编译期严格度。
 *
 * 1) fmt consteval 兜底（原功能保留）
 *    开启 RN 源码编译后，RN 0.83.2 自带的 fmt 11.0.2 会在 Xcode 26.4+（Apple Clang 21）
 *    因更严格的 C++20 consteval 规则编译失败：
 *      error: call to consteval function 'fmt::basic_format_string...' is not a constant expression
 *    标准救法：仅把 `fmt` 这一个 pod 的 C++ 语言标准降为 c++17（consteval 在 C++17 下不存在，
 *    问题代码路径被跳过）。作用域严格限定 `target.name == 'fmt'`。
 *
 * ⚠️ 关键约束：CocoaPods 不允许存在多个 post_install 钩子。Expo 生成的 Podfile 自带一个
 *    post_install 块，本插件绝不追加第二个独立 post_install，而是把上面两段代码**注入到
 *    已有的 post_install 块内部**（在其结束的 end 之前插入）。若 Podfile 中确实没有任何
 *    post_install（极少见），才在末尾新建一个。两段代码合并进同一个钩子，避免冲突。
 * ---------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# Xcode 26 strict-Clang relax (fmt c++17 + treat-warnings-as-errors=NO)';

// 判断 s 在位置 i 是否以一个完整的单词 word 开头/结尾（word boundary）。
function isWordAt(s, i, word) {
  const before = i > 0 ? s[i - 1] : ' ';
  const after = i + word.length < s.length ? s[i + word.length] : ' ';
  if (!/[\s\W]/.test(before)) return false;
  if (!/[\s\W]/.test(after)) return false;
  return s.substr(i, word.length) === word;
}

// 从 startIndex 开始，找到与 post_install 配对的结束 `end` 的位置（返回 end 关键字之后的索引）。
// 只在意 block 结构：把 do / def / class / module / begin / case 当作开块，end 当作闭块。
// 故意不把 if / unless / while / until 当开块——Podfile 里它们几乎总是 `stmt if cond` 修饰写法，
// 没有对应的 end，若计入会导致 depth 失衡。通常的 Expo post_install 只用 do..end 与 if 修饰，
// 此简化在此场景下稳健。
function findPostInstallEnd(contents, startIndex) {
  let i = startIndex;
  let depth = 0;
  const n = contents.length;
  const openers = ['do', 'def', 'class', 'module', 'begin', 'case'];
  while (i < n) {
    const ch = contents[i];
    if (ch === '#') {
      while (i < n && contents[i] !== '\n') i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      i++;
      while (i < n) {
        if (contents[i] === '\\') { i += 2; continue; }
        if (contents[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t' || ch === '(' || ch === ')') {
      i++;
      continue;
    }
    if (isWordAt(contents, i, 'end')) {
      depth--;
      i += 3;
      if (depth === 0) return i;
      continue;
    }
    let matched = false;
    for (const w of openers) {
      if (isWordAt(contents, i, w)) {
        depth++;
        i += w.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    i++;
  }
  return -1;
}

// 纯函数：把 fmt 修复注入到 Podfile 内容中，返回新内容。供测试独立验证。
function injectFmtFix(contents) {
  if (contents.includes(MARKER)) {
    return contents; // 已注入，幂等
  }

  // fmt 专用的 c++17 降级块（仅作用于 target.name == 'fmt'）。
  const fmtTargetBlock =
    "  installer.pods_project.targets.each do |target|\n" +
    "    if target.name == 'fmt'\n" +
    "      target.build_configurations.each do |config|\n" +
    "        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'\n" +
    '      end\n' +
    '    end\n' +
    '  end\n';

  // Xcode 26 严格 Clang 兜底：放开「警告当错误」并剥离所有 -Werror 显式标志。
  // 关键：C++ 库（fmt / RN 的 C++ 源码）用的是 OTHER_CPLUSPLUSFLAGS，不只是 OTHER_CFLAGS，
  // 故必须把所有可能携带 -Werror 的 flag 键都扫一遍，否则 C++ 编译仍会 [-Werror,-Wreturn-type] 失败。
  const relaxBlock =
    '  # Xcode 26 strict-Clang relax: 第三方/RN 自带原生代码的历史警告在 Xcode 26 被升级为硬错误\n' +
    '  # （如 non-void function does not return a value in all control paths [-Werror,-Wreturn-type]）。\n' +
    '  # 放开「警告当错误」并剥离所有 -Werror 显式标志（含 C++ 的 OTHER_CPLUSPLUSFLAGS），\n' +
    '  # 让这些警告恢复成仅警告（不影响 App 自身代码与运行时行为）。\n' +
    '  # 项目级 + target 级都处理（部分 -Werror 写在 Pods 工程的 project 配置里）。\n' +
    "  installer.pods_project.build_configurations.each do |config|\n" +
    "    config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'\n" +
    "    ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'WARNING_CFLAGS', 'CLANG_CXX_FLAGS', 'CLANG_C_FLAGS', 'OTHER_SWIFT_FLAGS'].each do |flag_key|\n" +
    "      v = config.build_settings[flag_key]\n" +
    "      if v.is_a?(Array)\n" +
    "        v.reject! { |f| f == '-Werror' || (f.is_a?(String) && f.start_with?('-Werror')) }\n" +
    "      elsif v.is_a?(String)\n" +
    "        config.build_settings[flag_key] = v.gsub(/-Werror(?:=[A-Za-z0-9_-]+)?/, '').strip\n" +
    '      end\n' +
    '    end\n' +
    '  end\n' +
    "  installer.pods_project.targets.each do |target|\n" +
    "    target.build_configurations.each do |config|\n" +
    "      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'\n" +
    "      ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'WARNING_CFLAGS', 'CLANG_CXX_FLAGS', 'CLANG_C_FLAGS', 'OTHER_SWIFT_FLAGS'].each do |flag_key|\n" +
    "        v = config.build_settings[flag_key]\n" +
    "        if v.is_a?(Array)\n" +
    "          v.reject! { |f| f == '-Werror' || (f.is_a?(String) && f.start_with?('-Werror')) }\n" +
    "        elsif v.is_a?(String)\n" +
    "          config.build_settings[flag_key] = v.gsub(/-Werror(?:=[A-Za-z0-9_-]+)?/, '').strip\n" +
    '        end\n' +
    '      end\n' +
    '    end\n' +
    '  end';

  const fmtBody = '  ' + MARKER + '\n' + fmtTargetBlock + relaxBlock;

  const m = contents.search(/\bpost_install\b/);
  if (m === -1) {
    // Podfile 中没有现成 post_install → 在末尾新建一个（此分支极少见）。
    const block =
      '\n\n' +
      MARKER +
      '\npost_install do |installer|\n' +
      fmtTargetBlock +
      relaxBlock +
      '\n';
    return contents + block;
  }

  // 已有 post_install → 注入到它的结束 end 之前。
  const after = findPostInstallEnd(contents, m);
  if (after === -1) {
    throw new Error(
      '[withFmtConstevalFix] 无法定位 post_install 的结束 end，请检查 Podfile 结构是否异常'
    );
  }
  const endIdx = after - 3; // 'end' 关键字起始位置
  return contents.slice(0, endIdx) + '\n' + fmtBody + '\n' + contents.slice(endIdx);
}

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      const updated = injectFmtFix(contents);
      if (updated !== contents) {
        fs.writeFileSync(podfile, updated, 'utf8');
      }
      return cfg;
    },
  ]);
};

module.exports.injectFmtFix = injectFmtFix;
