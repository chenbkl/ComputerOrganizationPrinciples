/// <reference types="frida-gum" />
/**
 * trace-subcalls.ts
 * 进入目标函数时开始 Stalker 跟踪当前线程，直到该函数返回为止；期间打印所有子调用。
 * 兼容：ObjC 方法 / 原生导出符号。支持模块过滤与递归/重入（最外层返回时停止跟踪）。
 */

/* ===================== 配置区 ===================== */
type Mode = 'objc' | 'native';
const MODE: Mode = 'objc';

/** ObjC 目标（当 MODE='objc' 时生效） */
const OBJC_CLASS = 'APSTCPStream';
const OBJC_SEL   = '- writeDataInBackground:'; // 例：实例方法；类方法用 '+ foo:'

/** 原生目标（当 MODE='native' 时生效） */
const NATIVE_SYMBOL: string | null = null;     // 例：'mach_msg'、'open'
const NATIVE_MODULE: string | null = null;     // 指定模块名或 null=全局导出搜索

/** 只打印这些模块（留空=不过滤）——建议加你的 App/私有框架名 */
const ONLY_MODULES = new Set<string>([
  // 'YourApp', 'YourFramework'
]);

/** 排除系统库（当 ONLY_MODULES 为空时生效） */
const EXCLUDE_SYSTEM = true;

/** 最大缩进深度，避免刷屏 */
const MAX_DEPTH = 64;
/* ================================================= */

/** 线程状态：active=目标函数嵌套层数；depth=子调用缩进层数 */
interface ThreadState { active: number; depth: number; }
const states = new Map<ThreadId, ThreadState>();

/* -------------------- 工具函数 -------------------- */
function ensureState(tid: ThreadId): ThreadState {
  let st = states.get(tid);
  if (!st) { st = { active: 0, depth: 0 }; states.set(tid, st); }
  return st;
}

function isNoisyModule(mod: Module | null): boolean {
  if (!mod) return false;
  if (ONLY_MODULES.size > 0) return !ONLY_MODULES.has(mod.name);
  if (!EXCLUDE_SYSTEM) return false;
  const p = mod.path ?? '';
  return p.startsWith('/System/') || p.startsWith('/usr/') || p.startsWith('/Library/');
}

function hex(n: number | Int64 | UInt64): string {
  try { return '0x' + (typeof n === 'number' ? n.toString(16) : (n as any).toString(16)); }
  catch { return String(n); }
}

function fmt(addr: NativePointer): string {
  const sym = DebugSymbol.fromAddress(addr);
  const modName = sym.moduleName ?? '<?>';
  const name = sym.name ?? addr.toString();
  const mod = Process.findModuleByAddress(addr);
  const off = mod ? hex(ptr(addr).sub(mod.base).toUInt32()) : '0x0';
  return `${modName}!${name} +${off}`;
}

/** 跟踪指定线程：进入目标函数的最外层实例时开启，最外层返回时关闭 */
function followIfNeeded(tid: ThreadId) {
  const st = ensureState(tid);
  if (st.active === 1) {
    st.depth = 0;
    Stalker.follow(tid, {
      events: { call: true, ret: true },
      onReceive(raw: ArrayBuffer) {
        const events = Stalker.parse(raw) as any[];
        for (const ev of events) {
          if (ev.type === 'call') {
            st.depth = Math.min(st.depth + 1, MAX_DEPTH);
            const target: NativePointer = ev.target;
            const mod = Process.findModuleByAddress(target);
            if (!isNoisyModule(mod)) {
              console.log('  '.repeat(st.depth) + '↳ ' + fmt(target));
            }
          } else if (ev.type === 'ret') {
            if (st.depth > 0) st.depth--;
          }
        }
      }
    });
  }
}

function unfollowIfNeeded(tid: ThreadId) {
  const st = ensureState(tid);
  if (st.active === 0) {
    Stalker.unfollow(tid);
    Stalker.garbageCollect();
  }
}

/** 解析原生符号地址（优先全局导出；可选模块精确匹配；最后用 DebugSymbol 兜底） */
function resolveNativeAddress(symbolName: string, moduleName?: string | null): NativePointer | null {
  try {
    if (moduleName && moduleName.length > 0) {
      return Module.getExportByName(moduleName, symbolName);
    }
  } catch { /* 指定模块未找到，继续 */ }

  try {
    const getGlobal = (Module as any).getGlobalExportByName as ((s: string) => NativePointer) | undefined;
    if (getGlobal) return getGlobal(symbolName);
  } catch { /* 全局导出未找到，继续 */ }

  try {
    return DebugSymbol.fromName(symbolName).address;
  } catch {
    return null;
  }
}

function attachTo(address: NativePointer | null, tag: string) {
  if (!address || address.isNull()) {
    console.error(`[!] 找不到目标入口：${tag}`);
    return;
  }
  console.log(`[+] attach ${tag} at ${address}`);

  Interceptor.attach(address, {
    onEnter() {
      const tid = Process.getCurrentThreadId();
      const st = ensureState(tid);
      st.active++;
      if (st.active === 1) {
        console.log(`\n=== ENTER ${tag} (tid=${tid}) ===`);
      }
      followIfNeeded(tid);
    },
    onLeave() {
      const tid = Process.getCurrentThreadId();
      const st = ensureState(tid);
      st.active = Math.max(0, st.active - 1);
      if (st.active === 0) {
        unfollowIfNeeded(tid);
        console.log(`=== LEAVE ${tag} (tid=${tid}) ===\n`);
      }
    }
  });
}

/* ---------------------- 入口 ---------------------- */
function main() {
  if (MODE === 'objc') {
    if (!ObjC.available) {
      console.error('[!] ObjC 不可用，请切换 MODE="native" 或选择含 ObjC 的进程');
      return;
    }
    const C: any = (ObjC.classes as any)[OBJC_CLASS];
    const m = C && C[OBJC_SEL];
    const impl: NativePointer | null = m ? m.implementation : null;
    attachTo(impl, `${OBJC_CLASS} ${OBJC_SEL}`);
  } else {
    if (!NATIVE_SYMBOL) {
      console.error('[!] 请设置 NATIVE_SYMBOL');
      return;
    }
    const addr = resolveNativeAddress(NATIVE_SYMBOL, NATIVE_MODULE);
    attachTo(addr, `${NATIVE_MODULE ?? '<global>'}!${NATIVE_SYMBOL}`);
  }
}

main();