// /// <reference types="frida-gum" />
// import ObjC from "frida-objc-bridge";
// /**
//  * trace_userinfo_build_chain.ts
//  * 目标：溯源 -[APSOutgoingMessage userInfo] 的字典构造与消费。
//  *
//  * 用法：
//  *   frida-compile -o build/trace_userinfo_build_chain.js src/trace_userinfo_build_chain.ts
//  *   frida -U -n apsd -l build/trace_userinfo_build_chain.js
//  */
// /* ================= 配置区 ================= */
// const PARENT_CLASS = 'APSOutgoingMessage';
// const PARENT_SEL = '- userInfo';
// const OPTIONS = {
//   HOOK_CF: true,                    // 记录 CFDictionary 构造/写入
//   HOOK_READS: true,                 // 记录字典读取（objectForKey:/valueForKey:）
//   FILTER_READS_BY_MODULE: 'apsd',   // 只打印来自该模块的读取（避免噪声）
//   PRETTY_PRINT_RET: true,           // 父方法返回值漂亮打印
//   JSON_PRETTY: true,                // 优先 NSJSONSerialization
//   JSON_SPACES: 2,
// };
// /* =============== 运行期状态 =============== */
// type Ev =
//   | { kind: 'new'; dict: NativePointer; via: string; caller: string }
//   | { kind: 'set'; dict: NativePointer; key: string; val: string; vcls: string; caller: string }
//   | { kind: 'class'; dict: NativePointer; cls: string };
// const eventsByTid = new Map<Tid, Ev[]>();
// const depthByTid = new Map<Tid, number>();
// function inWindow(tid: Tid) { return (depthByTid.get(tid) ?? 0) > 0; }
// function enterWindow(tid: Tid) { depthByTid.set(tid, (depthByTid.get(tid) ?? 0) + 1); }
// function leaveWindow(tid: Tid) {
//   const d = (depthByTid.get(tid) ?? 1) - 1;
//   if (d <= 0) depthByTid.delete(tid); else depthByTid.set(tid, d);
// }
// /* =============== 小工具 =============== */
// function callerSym(ret: NativePointer) {
//   try { const ds = DebugSymbol.fromAddress(ret); return `${ds.moduleName || ''}!${ds.name || ret}`; }
//   catch { return ret.toString(); }
// }
// function shallowValSummary(p: NativePointer): { vcls: string; text: string } {
//   try {
//     const o = new ObjC.Object(p);
//     return { vcls: o.$className || 'id', text: o.$className || o.toString() };
//   } catch {
//     return { vcls: 'ptr', text: p.toString() };
//   }
// }
// // 没有 ObjC.autoreleasePool 的兼容池
// function withAutoreleasePool<T>(fn: () => T): T {
//   try {
//     const NSAutoreleasePool = ObjC.classes.NSAutoreleasePool;
//     if (!NSAutoreleasePool) return fn();
//     const pool = NSAutoreleasePool.alloc().init();
//     try { return fn(); } finally { pool.release(); }
//   } catch { return fn(); }
// }
// /* =============== 父窗口：-[APSOutgoingMessage userInfo] =============== */
// setImmediate(() => {
//   if (!ObjC.available) { console.log('ObjC not available'); return; }
//   const C = ObjC.classes[PARENT_CLASS];
//   const M = C?.[PARENT_SEL];
//   if (!M) { console.log(`Parent not found: [${PARENT_CLASS} ${PARENT_SEL}]`); return; }
//   console.log(`[hook] parent [${PARENT_CLASS} ${PARENT_SEL}] types=${(M as any).types}`);
//   Interceptor.attach(M.implementation, {
//     onEnter() {
//       const tid = this.threadId as Tid;
//       enterWindow(tid);
//       eventsByTid.set(tid, []);
//       console.log(`\n[ENTER parent] ${PARENT_CLASS} ${PARENT_SEL}`);
//     },
//     onLeave(rv) {
//       withAutoreleasePool(() => {
//         const tid = this.threadId as Tid;
//         const evs = eventsByTid.get(tid) || [];
//         console.log('--- build log (within userInfo window) ---');
//         const byDict = new Map<string, Ev[]>();
//         for (const e of evs) {
//           const k = ('dict' in e) ? e.dict.toString() : 'n/a';
//           if (!byDict.has(k)) byDict.set(k, []);
//           byDict.get(k)!.push(e);
//         }
//         for (const [dict, list] of byDict.entries()) {
//           console.log(`\n[dict ${dict}]`);
//           for (const e of list) {
//             if (e.kind === 'class') {
//               console.log(`  class -> ${e.cls}`);
//             } else if (e.kind === 'new') {
//               console.log(`  NEW   via ${e.via} @ ${e.caller}`);
//             } else { // set
//               console.log(`  SET   key="${e.key}" val(${e.vcls})=${e.val} @ ${e.caller}`);
//             }
//           }
//         }
//         // 返回对象（最终字典）
//         try {
//           const obj = new ObjC.Object(rv);
//           const cls = obj.$className;
//           console.log(`\n[ret] class=${cls}`);
//           if (OPTIONS.PRETTY_PRINT_RET) {
//             const out = prettyDescribeNSObject(obj);
//             console.log(out);
//           } else {
//             console.log(obj.toString());
//           }
//         } catch { console.log(`[ret] ${rv}`); }
//         console.log('-----------------------------------------\n');
//         eventsByTid.delete(tid);
//         leaveWindow(tid);
//       });
//     }
//   });
//   // —— 上游：可变字典写入（__NSDictionaryM） ——
//   hookNSMutableDictWrites();
//   // —— 上游：NSDictionary 工厂 ——
//   hookNSDictionaryFactories();
//   // —— 上游（可选）：CoreFoundation 字典 ——
//   if (OPTIONS.HOOK_CF) hookCFDict();
//   // —— 下游（可选）：字典读取（按模块过滤） ——
//   if (OPTIONS.HOOK_READS) hookDictReadsFiltered(OPTIONS.FILTER_READS_BY_MODULE);
//   // ——（可选）扫描 APS* 类里可疑构造器名 ——（需要时解除注释）
//   // listAPSBuilders();
// });
// /* =============== 钩子实现 =============== */
// function hookNSMutableDictWrites() {
//   const MDM = ObjC.classes.__NSDictionaryM;
//   if (!MDM) return;
//   const implA = MDM['- setObject:forKey:']?.implementation;
//   const implB = MDM['- setValue:forKey:']?.implementation;
//   function onSet(this: InvocationContext, args: InvocationArguments) {
//     const tid = this.threadId as Tid;
//     if (!inWindow(tid)) return;
//     try {
//       const dict = args[0] as NativePointer;
//       const key = new ObjC.Object(args[3] as NativePointer).toString();
//       const sv = shallowValSummary(args[2] as NativePointer);
//       const caller = callerSym(this.returnAddress);
//       eventsByTid.get(tid)?.push({ kind: 'set', dict, key, val: sv.text, vcls: sv.vcls, caller });
//     } catch { }
//   }
//   if (implA) Interceptor.attach(implA, { onEnter: onSet });
//   if (implB) Interceptor.attach(implB, { onEnter: onSet });
//   // 标注 __NSDictionaryM 的 init → class
//   const initImp = MDM['- init']?.implementation;
//   if (initImp) Interceptor.attach(initImp, {
//     onLeave(rv) {
//       const tid = this.threadId as Tid;
//       if (!inWindow(tid)) return;
//       try { eventsByTid.get(tid)?.push({ kind: 'class', dict: rv, cls: '__NSDictionaryM' }); } catch { }
//     }
//   });
//   console.log('[hook] __NSDictionaryM setObject:/setValue:/init');
// }
// function hookNSDictionaryFactories() {
//   const NSD = ObjC.classes.NSDictionary;
//   if (!NSD) return;
//   const okc = NSD['+ dictionaryWithObjects:forKeys:count:']?.implementation;
//   if (okc) Interceptor.attach(okc, {
//     onLeave(rv) {
//       const tid = this.threadId as Tid;
//       if (!inWindow(tid)) return;
//       const caller = callerSym(this.returnAddress);
//       eventsByTid.get(tid)?.push({ kind: 'new', dict: rv, via: 'dictionaryWithObjects:forKeys:count:', caller });
//     }
//   });
//   const byD = NSD['+ dictionaryWithDictionary:']?.implementation;
//   if (byD) Interceptor.attach(byD, {
//     onLeave(rv) {
//       const tid = this.threadId as Tid;
//       if (!inWindow(tid)) return;
//       const caller = callerSym(this.returnAddress);
//       eventsByTid.get(tid)?.push({ kind: 'new', dict: rv, via: 'dictionaryWithDictionary:', caller });
//     }
//   });
//   console.log('[hook] NSDictionary factories');
// }
// function hookCFDict() {
//   let cf: Module;
//   try { cf = Process.getModuleByName('CoreFoundation'); } catch { return; }
//   const CFDictionaryCreateMutable = cf.findExportByName('CFDictionaryCreateMutable');
//   const CFDictionarySetValue = cf.findExportByName('CFDictionarySetValue');
//   if (CFDictionaryCreateMutable) Interceptor.attach(CFDictionaryCreateMutable, {
//     onLeave(rv) {
//       const tid = this.threadId as Tid;
//       if (!inWindow(tid)) return;
//       const caller = callerSym(this.returnAddress);
//       eventsByTid.get(tid)?.push({ kind: 'new', dict: rv, via: 'CFDictionaryCreateMutable', caller });
//     }
//   });
//   if (CFDictionarySetValue) Interceptor.attach(CFDictionarySetValue, {
//     onEnter(args) {
//       const tid = this.threadId as Tid;
//       if (!inWindow(tid)) return;
//       const dict = args[0] as NativePointer;
//       const caller = callerSym(this.returnAddress);
//       eventsByTid.get(tid)?.push({
//         kind: 'set',
//         dict,
//         key: `<CFKey ${args[1]}>`,
//         val: `<CFVal ${args[2]}>`,
//         vcls: 'CFTypeRef',
//         caller
//       });
//     }
//   });
//   console.log('[hook] CFDictionaryCreateMutable/SetValue');
// }
// function hookDictReadsFiltered(moduleContains: string) {
//   const I = ObjC.classes.__NSDictionaryI;
//   const M = ObjC.classes.__NSDictionaryM;
//   ObjC.Object
//   const specs: Array<[any, string]> = [];
//   if (I && I['- objectForKey:']) specs.push([I, '- objectForKey:']);
//   if (I && I['- valueForKey:']) specs.push([I, '- valueForKey:']);
//   if (M && M['- objectForKey:']) specs.push([M, '- objectForKey:']);
//   if (M && M['- valueForKey:']) specs.push([M, '- valueForKey:']);
//   for (const [Cls, sel] of specs) {
//     Interceptor.attach(Cls[sel].implementation, {
//       onEnter(args) {
//         const sym = DebugSymbol.fromAddress(this.returnAddress);
//         const mod = sym.moduleName || '';
//         if (!mod.includes(moduleContains)) return;
//         let key = '<non-str>';
//         try { key = new ObjC.Object(args[2]).toString(); } catch { }
//         console.log(`[DICT READ] ${Cls.$className} ${sel} key="${key}" @ ${sym.name || this.returnAddress}`);
//       }
//     });
//   }
//   console.log(`[hook] NSDictionary reads (filter="${moduleContains}")`);
// }
// /* =============== 漂亮打印 =============== */
// function prettyDescribeNSObject(o: any): string {
//   const NSJSON = ObjC.classes.NSJSONSerialization;
//   const NSString = ObjC.classes.NSString;
//   const NSArray = ObjC.classes.NSArray;
//   const NSDictionary = ObjC.classes.NSDictionary;
//   const NSSet = ObjC.classes.NSSet;
//   const NSData = ObjC.classes.NSData;
//   const NSNumber = ObjC.classes.NSNumber;
//   const NSDate = ObjC.classes.NSDate;
//   function tryJSON(obj: any): string | null {
//     if (!OPTIONS.JSON_PRETTY) return null;
//     try {
//       if (NSJSON['+ isValidJSONObject:'] && !NSJSON['+ isValidJSONObject:'](obj)) return null;
//       const opts = 1; // pretty
//       const data = NSJSON['+ dataWithJSONObject:options:error:'](obj, opts, ptr(0));
//       if (ptr(data).isNull()) return null;
//       const s = NSString.alloc()['- initWithData:encoding:'](data, 4 /* UTF8 */);
//       const txt = new ObjC.Object(s).toString();
//       if (OPTIONS.JSON_SPACES !== 2) return txt; // NSJSON 的 pretty 是固定两个空格，仅原样返回
//       return txt;
//     } catch { return null; }
//   }
//   function describeNSData(o: any): string {
//     try {
//       const len = o['- length']() as number;
//       const s = NSString.alloc()['- initWithData:encoding:'](o, 4);
//       const txt = new ObjC.Object(s).toString();
//       if (txt && txt.length) {
//         const max = 200;
//         const body = txt.length > max ? (txt.slice(0, max) + '…') : txt;
//         return `<NSData len=${len} utf8=${JSON.stringify(body)}>`;
//       }
//       const bytes = o['- bytes']() as NativePointer;
//       const n = Math.min(64, len | 0), hex: string[] = [];
//       for (let i = 0; i < n; i++) hex.push(('0' + bytes.add(i).readU8().toString(16)).slice(-2));
//       return `<NSData len=${len} hex=${hex.join(' ')}${len > n ? ' …' : ''}>`;
//     } catch { return `<NSData ${o.toString()}>`; }
//   }
//   if (o == null) return '<nil>';
//   if (o.isKindOfClass_(ObjC.classes.NSString) ||
//     o.isKindOfClass_(ObjC.classes.NSNumber) ||
//     o.isKindOfClass_(ObjC.classes.NSDate)) {
//     return o.toString();
//   }
//   if (o.isKindOfClass_(ObjC.classes.NSData)) return describeNSData(o);
//   if (o.isKindOfClass_(NSArray) || o.isKindOfClass_(NSSet) || o.isKindOfClass_(NSDictionary)) {
//     const j = tryJSON(o);
//     if (j) return j;
//     try {
//       if (o['- descriptionWithLocale:indent:']) {
//         return new ObjC.Object(o['- descriptionWithLocale:indent:'](ptr(0), 2)).toString();
//       }
//     } catch { }
//     return o.toString();
//   }
//   return `${o.$className ?? ''} ${o.toString()}`;
// }
// /* =============== 可选：扫描可疑构造器名 =============== */
// function listAPSBuilders() {
//   for (const name in ObjC.classes) {
//     if (!name.startsWith('APS')) continue;
//     const klass = ObjC.classes[name];
//     const own = (klass.$ownMethods || []).filter(m => /info|dict|payload|meta/i.test(m));
//     if (own.length) console.log(name, '->', own.join(', '));
//   }
// }
