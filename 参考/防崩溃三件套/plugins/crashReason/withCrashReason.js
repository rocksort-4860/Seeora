const { withAppDelegate } = require('@expo/config-plugins');

// 自由 C 函数放在 @implementation 之外（文件顶层），否则 clang 编译报错。
// 只把 +load 方法留在 @implementation 内部。
// 注意转义：本文件是 JS 模板字符串，写入 .m 的内容需要的是「单反斜杠 \n」，
// 因此这里必须写成「双反斜杠 \\n」（JS 解释 \\ 为单个 \）。
const PRE = `
// ===== CrashReason PRE (free functions, file scope) =====
#import <execinfo.h>
#import <signal.h>
#import <unistd.h>
#import <stdio.h>
#import <stdlib.h>

static volatile sig_atomic_t g_CR_handled = 0;

// 注意：此函数在信号上下文被调用，并非严格 async-signal-safe，
// 但作为开发期诊断可接受；g_CR_handled 防止重入。
static void CR_write_text(const char *text) {
  @autoreleasepool {
    NSArray<NSString *> *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *dir = paths.firstObject ?: NSTemporaryDirectory();
    NSString *path = [dir stringByAppendingPathComponent:@"crash_reason.txt"];
    NSString *prev = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
    NSMutableString *out = [NSMutableString stringWithString:prev ? prev : @""];
    if (out.length) { [out appendString:@"\\n========\\n"]; }
    NSDate *now = [NSDate date];
    [out appendFormat:@"%@\\n%@", now, [NSString stringWithUTF8String:text]];
    [out writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:nil];
    [[NSUserDefaults standardUserDefaults] setObject:out forKey:@"crash_reason"];
  }
}

static void CR_capture_backtrace(const char *header) {
  void *addrs[128];
  int n = backtrace(addrs, 128);
  char **syms = backtrace_symbols(addrs, n);
  NSMutableString *s = [NSMutableString stringWithFormat:@"%s\\nframes=%d\\n", header ? header : "", n];
  for (int i = 0; i < n && syms; i++) {
    [s appendFormat:@"%d: %s\\n", i, syms[i]];
  }
  if (syms) { free(syms); }
  CR_write_text([s UTF8String]);
}

// 兜底：真正的未捕获 NSException（本次崩溃走不到这里，但在 +load 注册无害）
static void CR_objc_handler(NSException *exception) {
  if (g_CR_handled) return;
  g_CR_handled = 1;
  NSMutableString *s = [NSMutableString stringWithFormat:
    @"[NSException] name=%@ reason=%@\\n%@",
    exception.name ?: @"(null)", exception.reason ?: @"(null)", exception.callStackSymbols];
  CR_write_text([s UTF8String]);
}

// 关键：抓 abort() 抛出的 SIGABRT（以及其它致命信号），
// 本次后台线程 turbomodule 崩溃正是 abort() -> SIGABRT。
static void CR_signal_handler(int sig) {
  if (g_CR_handled) return;
  g_CR_handled = 1;
  char label[64];
  snprintf(label, sizeof(label), "[signal %d]", sig);
  CR_capture_backtrace(label);
  // 还原默认行为并重新触发，确保进程真正终止（避免信号处理器内死循环）
  signal(sig, SIG_DFL);
  raise(sig);
}
// ===== end CrashReason PRE =====
`;

const POST = `
// ===== CrashReason POST (+load, inside @implementation) =====
+ (void)load {
  NSSetUncaughtExceptionHandler(&CR_objc_handler);
  signal(SIGABRT, CR_signal_handler);
  signal(SIGSEGV, CR_signal_handler);
  signal(SIGBUS, CR_signal_handler);
  signal(SIGILL, CR_signal_handler);
}
// ===== end CrashReason POST =====
`;

module.exports = function withCrashReason(config) {
  return withAppDelegate(config, async (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('CR_objc_handler')) {
      // 仅匹配标准 Expo 生成的 @implementation AppDelegate（不带 category）
      const replaced = contents.replace(
        /@implementation\s+AppDelegate\b/,
        PRE + '\n@implementation AppDelegate\n' + POST
      );
      // 失败变响：现代 Expo 可能用 Swift AppDelegate，正则匹配不到时不再静默漏装。
      if (replaced === contents) {
        console.warn(
          '[crashReason] ⚠️ 未在 AppDelegate 中找到 @implementation AppDelegate，' +
          '可能工程使用 Swift AppDelegate，原生崩溃记录器【未注入】（不影响 turboModuleFix 主修复）。'
        );
      }
      contents = replaced;
    }
    config.modResults.contents = contents;
    return config;
  });
};
