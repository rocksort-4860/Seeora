/*
 * withFmtConstevalFix.js
 * ---------------------------------------------------------------------------
 * 配套 buildReactNativeFromSource=true 的必要兜底。
 *
 * 背景：开启 RN 源码编译后，RN 0.83.2 自带的 fmt 11.0.2 会在 Xcode 26.4+（Apple Clang 21）
 *       因更严格的 C++20 consteval 规则编译失败：
 *         error: call to consteval function 'fmt::basic_format_string...' is not a constant expression
 *       这是上游 RN bug（expo/expo#44229，facebook/react-native#55601），仅影响「源码编译」，
 *       预编译二进制不受影响——而我们恰恰必须源码编译才能让补丁进包。
 *
 * 标准救法（社区与官方讨论一致）：仅把 `fmt` 这一个 pod 的 C++ 语言标准降为 c++17。
 *       因为 consteval 在 C++17 下不存在，问题代码路径被跳过，fmt 退回运行时格式校验；
 *       项目其余部分仍用 C++20，不动 RN 内部。作用域严格限定 `target.name == 'fmt'`，不波及其它 pod。
 *
 * 即便 EAS 锁定 Xcode 26.2（Clang 20 不触发该 bug），此补丁也无害（fmt 在 c++17 下本就能编）。
 * 它是「万一 Xcode 升到 26.4」的保险，不是多余 hack。
 *
 * ⚠️ 关键约束：CocoaPods 不允许存在多个 post_install 钩子（会直接报错
 *   "Specifying multiple post_install hooks is unsupported"）。Expo 生成的 Podfile 自带一个
 *   post_install 块，因此本插件绝不追加第二个独立 post_install，而是把 fmt 代码**注入到
 *   已有的 post_install 块内部**（在其结束的 end 之前插入）。若 Podfile 中确实没有任何
 *   post_install（极少见），才在末尾新建一个。
 * ---------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# fmt consteval fix (Xcode 26.4+ / Apple Clang 21)';

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

  const fmtBody =
    '  # fmt consteval fix (Xcode 26.4+ / Apple Clang 21)\n' +
    "  installer.pods_project.targets.each do |target|\n" +
    "    if target.name == 'fmt'\n" +
    "      target.build_configurations.each do |config|\n" +
    "        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'\n" +
    '      end\n' +
    '    end\n' +
    '  end';

  const m = contents.search(/\bpost_install\b/);
  if (m === -1) {
    // Podfile 中没有现成 post_install → 在末尾新建一个（此分支极少见）。
    const block =
      '\n\n' +
      MARKER +
      '\npost_install do |installer|\n' +
      "  installer.pods_project.targets.each do |target|\n" +
      "    if target.name == 'fmt'\n" +
      "      target.build_configurations.each do |config|\n" +
      "        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'\n" +
      '      end\n' +
      '    end\n' +
      '  end\n';
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
