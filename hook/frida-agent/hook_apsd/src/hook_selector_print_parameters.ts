/// <reference types="frida-gum" />
/// <reference path="./types/frida-objc.d.ts" />

const CLASS = 'APSOutgoingMessage';
const SEL   = '- userInfo';

// —— 线程内重入保护（避免 description/JSON 内部再次触发本方法）——
type Tid = ThreadId | number;
const printingDepth = new Map<Tid, number>();
function enterPrinting(tid: Tid): boolean {
  const d = (printingDepth.get(tid) ?? 0) + 1;
  printingDepth.set(tid, d);
  return d === 1;
}
function leavePrinting(tid: Tid) {
  const d = (printingDepth.get(tid) ?? 1) - 1;
  if (d <= 0) printingDepth.delete(tid); else printingDepth.set(tid, d);
}

// —— 兼容：没有 ObjC.autoreleasePool 时，用 NSAutoreleasePool 自己包一层 ——
// function withAutoreleasePool<T>(fn: () => T): T {
//   try {
//     const NSAutoreleasePool = ObjC.classes.NSAutoreleasePool;
//     if (!NSAutoreleasePool) return fn();
//     const pool = NSAutoreleasePool.alloc().init();
//     try { return fn(); } finally { pool.release(); }
//   } catch {
//     // Foundation 尚未就绪等情况，直接执行
//     return fn();
//   }
// }

setImmediate(() => {
  if (!ObjC.available) { console.log('ObjC not available'); return; }

  const C = ObjC.classes[CLASS];
  const M = C?.[SEL];
  if (!M) { console.log(`Method not found: [${CLASS} ${SEL}]`); return; }

  const retT = (M as any).returnType as string | undefined;
  const argT = (M as any).argumentTypes as string[] | undefined;
  const impl = M.implementation;

  console.log(`[hook] [${CLASS} ${SEL}]`);
  console.log('  types      =', (M as any).types);
  console.log('  returnType =', retT);
  console.log('  argTypes   =', argT);

  const selToString = makeSelToString();
  const pretty      = makePrettyPrinters();

  Interceptor.attach(impl, {
    onEnter(args) {
      console.log(`\n[ENTER] ${CLASS} ${SEL}`);
      if (!argT) return;

      // 跳过 self/_cmd，只打印“真正参数”
      for (let i = 2; i < argT.length; i++) {
        const t = argT[i] ?? 'pointer';
        const p = args[i] as NativePointer;
        const text = safeShallowFormat(t, p, selToString); // 入参阶段保持“浅打印”，避免重入
        console.log(`  arg${i - 2} (${t}) = ${text}`);
      }
    },

    onLeave(rv) {
      // 用我们自己的 withAutoreleasePool 包裹
      withAutoreleasePool(() => {
        const tid = this.threadId as Tid;
        const first = enterPrinting(tid);
        try {
          const t = retT ?? '?';
          const text = first
            ? formatValue(t, rv, selToString, pretty)   // 首次进入才做“重打印”
            : rv.toString();                            // 重入时仅打地址
          console.log(`  ret (${t}) = ${text}`);
          console.log('[LEAVE]');
        } finally {
          leavePrinting(tid);
        }
      });
    }
  });
});

/* ======== 入参的“浅打印” ======== */
function safeShallowFormat(t: string, p: NativePointer, selToString: (s: NativePointer) => string): string {
  try {
    switch (t) {
      case 'void':  return '(void)';
      case 'SEL':   return selToString(p);
      case 'char *':return p.isNull() ? '<nil>' : (p.readUtf8String?.() ?? (p as any).readCString?.() ?? '<empty>');
      case 'BOOL':  return String(p.toInt32() !== 0);
      default:      return p.toString(); // 不深入 ObjC 对象，避免在 onEnter 触发重入
    }
  } catch { return p.toString(); }
}

/* ======== 返回值等需要时才做的“完整打印” ======== */
function formatValue(
  t: string,
  p: NativePointer,
  selToString: (s: NativePointer) => string,
  pretty: ReturnType<typeof makePrettyPrinters>
): string {
  try {
    switch (t) {
      case 'void':  return '(void)';
      case 'SEL':   return selToString(p);
      case 'char *':return p.isNull() ? '<nil>' : (p.readUtf8String?.() ?? (p as any).readCString?.() ?? '<empty>');
      case 'BOOL':  return String(p.toInt32() !== 0);
      case 'id':
      case 'Class': {
        const o = new ObjC.Object(p);
        return pretty.describeNSObject(o);
      }
      default:
        try { return pretty.describeNSObject(new ObjC.Object(p)); } catch { return p.toString(); }
    }
  } catch { return p.toString(); }
}

/* ======== SEL -> 字符串 ======== */
function makeSelToString() {
  let sel_getName: ((p: NativePointer) => NativePointer) | null = null;
  try {
    const p = Process.getModuleByName('libobjc.A.dylib').findExportByName('sel_getName');
    if (p) sel_getName = new NativeFunction(p, 'pointer', ['pointer']) as any;
  } catch {}
  return (sel: NativePointer) => {
    try {
      const f = (ObjC as any).selectorAsString;
      if (typeof f === 'function') return f(sel);
    } catch {}
    if (sel_getName) {
      const c = sel_getName(sel) as NativePointer;
      return c.isNull() ? '<nil>' : (c.readUtf8String?.() ?? (c as any).readCString?.() ?? '<empty>');
    }
    return '<unknown_sel>';
  };
}

/* ======== Foundation 漂亮打印 ======== */
function makePrettyPrinters() {
  const NSJSON        = ObjC.classes.NSJSONSerialization;
  const NSString      = ObjC.classes.NSString;
  const NSArray       = ObjC.classes.NSArray;
  const NSDictionary  = ObjC.classes.NSDictionary;
  const NSSet         = ObjC.classes.NSSet;
  const NSData        = ObjC.classes.NSData;
  const NSNumber      = ObjC.classes.NSNumber;
  const NSDate        = ObjC.classes.NSDate;

  function tryJSON(obj: any): string | null {
    try {
      if (NSJSON['+ isValidJSONObject:'] && !NSJSON['+ isValidJSONObject:'](obj)) return null;
      const data = NSJSON['+ dataWithJSONObject:options:error:'](obj, 1, ptr(0)); // pretty=1
      if (ptr(data).isNull()) return null;
      const s = NSString.alloc()['- initWithData:encoding:'](data, 4 /* UTF8 */);
      return new ObjC.Object(s).toString();
    } catch { return null; }
  }

  function describeNSData(o: any): string {
    try {
      const len = o['- length']() as number;
      const s   = NSString.alloc()['- initWithData:encoding:'](o, 4);
      const txt = new ObjC.Object(s).toString();
      if (txt && txt.length) return `<NSData len=${len} utf8=${JSON.stringify(txt.slice(0,200))}${txt.length>200?'…':''}>`;
      const bytes = o['- bytes']() as NativePointer;
      const n = Math.min(32, len|0), hex: string[] = [];
      for (let i = 0; i < n; i++) hex.push(('0' + bytes.add(i).readU8().toString(16)).slice(-2));
      return `<NSData len=${len} hex=${hex.join(' ')}${len>n?' …':''}>`;
    } catch { return `<NSData ${o.toString()}>`; }
  }

  function describeNSObject(o: any): string {
    if (o == null) return '<nil>';
    if (o.isKindOfClass_(NSString) || o.isKindOfClass_(NSNumber) || o.isKindOfClass_(NSDate))
      return o.toString();
    if (o.isKindOfClass_(NSData)) return describeNSData(o);

    if (o.isKindOfClass_(NSArray) || o.isKindOfClass_(NSSet) || o.isKindOfClass_(NSDictionary)) {
      const j = tryJSON(o);
      if (j) return j;
      try {
        if (o['- descriptionWithLocale:indent:'])
          return new ObjC.Object(o['- descriptionWithLocale:indent:'](ptr(0), 2)).toString();
      } catch {}
      return o.toString();
    }
    return `${o.$className ?? ''} ${o.toString()}`;
  }

  return { describeNSObject };
}