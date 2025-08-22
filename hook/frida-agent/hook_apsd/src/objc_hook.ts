
// import ObjC from "frida-objc-bridge";

// /// <reference types="frida-gum" />

// /**
//  * objc_hook.ts
//  * 作用：Hook 指定的 ObjC 方法，按类型尽可能打印入参与返回值。
//  * 用法（Frida REPL）：
//  *   Hooker.hook({ cls: "APSTCPStream", sel: "- writeDataInBackground:" });
//  *   Hooker.hookMany([{ cls: "APSOutgoingMessage", sel: "- userInfo" }]);
//  *   Hooker.smartHook("ClassName", "selectorName:withArg:");
//  */

// 'use strict';

// const MAX_DEPTH = 2;
// const MAX_ITEMS = 50;

// type AnyObjC = ObjCObject & { $className?: string;[k: string]: any };
// type ArgOut = any;

// function isNativePointer(v: any): v is NativePointer {
//   return v && typeof v === 'object' && typeof (v as NativePointer).toString === 'function';
// }

// function isObjCPointer(p: NativePointer): boolean {
//   try { if (p.isNull()) return false; } catch { return false; }
//   try {
//     // 新版 Frida
//     // @ts-ignore
//     if (ObjC.api && typeof ObjC.api.isObjCObject === 'function') {
//       // @ts-ignore
//       return ObjC.api.isObjCObject(p);
//     }
//     // 旧版兼容：尝试构造 ObjC.Object
//     new ObjC.Object(p);
//     return true;
//   } catch {
//     return false;
//   }
// }

// function toJS(o: any, depth = 0): any {
//   if (o === null || o === undefined) return o;

//   if (isNativePointer(o)) {
//     if (o.isNull()) return { type: 'pointer', value: 'NULL' };
//     if (isObjCPointer(o)) {
//       try { return toJS(new ObjC.Object(o) as AnyObjC, depth); } catch { }
//     }
//     return { type: 'pointer', value: o.toString() };
//   }

//   const t = typeof o;
//   if (t === 'number' || t === 'boolean' || t === 'string') return o;

//   // ObjC 对象（粗判）
//   if ((o as AnyObjC)?.handle instanceof NativePointer) {
//     const obj = o as AnyObjC;
//     const cname = String(obj.$className || 'ObjC.Object');

//     const NSString = ObjC.classes.NSString;
//     const NSMutableString = ObjC.classes.NSMutableString;
//     const NSNumber = ObjC.classes.NSNumber;
//     const NSData = ObjC.classes.NSData;
//     const NSDate = ObjC.classes.NSDate;
//     const NSURL = ObjC.classes.NSURL;
//     const NSArray = ObjC.classes.NSArray;
//     const NSDictionary = ObjC.classes.NSDictionary;
//     const NSSet = ObjC.classes.NSSet;
//     const NSError = ObjC.classes.NSError;

//     const isKind = (C?: AnyObjC) => C && obj.isKindOfClass_(C);

//     if (isKind(NSString) || isKind(NSMutableString)) {
//       try { return { type: cname, value: obj.toString() }; } catch { return { type: cname, value: String(obj) }; }
//     }
//     if (isKind(NSNumber)) {
//       try { return { type: cname, value: obj.toString() }; } catch { return { type: cname, value: String(obj) }; }
//     }
//     if (NSData && isKind(NSData)) {
//       try {
//         const len = Number(obj.length());
//         const max = Math.min(64, len);
//         const buf = (Memory as any).readByteArray(obj.bytes(), max) as ArrayBuffer | null;
//         const hex = buf
//           ? Array.from(new Uint8Array(buf)).map(b => ('0' + b.toString(16)).slice(-2)).join('')
//           : '';
//         return { type: `${cname}(${len} bytes)`, previewHex: hex };
//       } catch { return { type: cname, value: obj.toString() }; }
//     }
//     if (NSDate && isKind(NSDate)) {
//       try { return { type: cname, value: obj.toString() }; } catch { return { type: cname, value: String(obj) }; }
//     }
//     if (NSURL && isKind(NSURL)) {
//       try { return { type: cname, value: obj.absoluteString().toString() }; } catch { return { type: cname, value: obj.toString() }; }
//     }
//     if (NSError && isKind(NSError)) {
//       try {
//         return {
//           type: cname,
//           domain: obj.domain() ? obj.domain().toString() : '',
//           code: obj.code ? Number(obj.code()) : 0,
//           desc: (obj.localizedDescription && obj.localizedDescription()) ? obj.localizedDescription().toString() : ''
//         };
//       } catch { return { type: cname, value: obj.toString() }; }
//     }
//     if (NSArray && isKind(NSArray)) {
//       if (depth >= MAX_DEPTH) return { type: cname, value: `Array(depth>${MAX_DEPTH}) size=${Number(obj.count())}` };
//       const count = Number(obj.count());
//       const limit = Math.min(count, MAX_ITEMS);
//       const arr: any[] = [];
//       for (let i = 0; i < limit; i++) {
//         try { arr.push(toJS(obj.objectAtIndex_(i), depth + 1)); } catch { arr.push('<err>'); }
//       }
//       if (count > limit) arr.push(`... (${count - limit} more)`);
//       return { type: cname, size: count, value: arr };
//     }
//     if (NSSet && isKind(NSSet)) {
//       try { return toJS(obj.allObjects(), depth); } catch { return { type: cname, value: obj.toString() }; }
//     }
//     if (NSDictionary && isKind(NSDictionary)) {
//       if (depth >= MAX_DEPTH) return { type: cname, value: `Dict(depth>${MAX_DEPTH}) size=${Number(obj.count())}` };
//       try {
//         const keys = obj.allKeys();
//         const kcount = Number(keys.count());
//         const limit = Math.min(kcount, MAX_ITEMS);
//         const out: Record<string, any> = {};
//         for (let i = 0; i < limit; i++) {
//           const k = keys.objectAtIndex_(i);
//           const v = obj.objectForKey_(k);
//           const keyStr = String((toJS(k, depth + 1) as any).value ?? toJS(k, depth + 1));
//           out[keyStr] = toJS(v, depth + 1);
//         }
//         if (kcount > limit) out['__more__'] = `${kcount - limit} more`;
//         return { type: cname, size: kcount, value: out };
//       } catch { return { type: cname, value: obj.toString() }; }
//     }
//     try { return { type: cname, value: obj.toString() }; } catch { return { type: cname, value: `<${cname} ${obj.handle}>` }; }
//   }

//   return String(o);
// }

// interface TypeSig {
//   ret: string;
//   args: string[];
// }

// function parseTypeEncoding(enc: string | null): TypeSig | null {
//   if (!enc) return null;
//   let i = 0;

//   function readOne(): string | null {
//     if (enc == null) return null;
//     if (i >= enc.length) return null;
//     const ch = enc[i++];

//     if (ch === '^') {
//       const inner = readOne();
//       return `^${inner ?? '?'}`;
//     }
//     if (ch === '{' || ch === '(' || ch === '[') {
//       const open = ch;
//       const close = ch === '{' ? '}' : ch === '(' ? ')' : ']';
//       let depth = 1;
//       const start = i - 1;
//       while (i < enc.length && depth > 0) {
//         const c = enc[i++];
//         if (c === open) depth++;
//         else if (c === close) depth--;
//       }
//       return enc.slice(start, i);
//     }
//     if (ch >= '0' && ch <= '9') return readOne();
//     return ch;
//   }

//   const tokens: string[] = [];
//   for (; ;) {
//     const t = readOne();
//     if (!t) break;
//     tokens.push(t);
//   }
//   if (tokens.length === 0) return null;
//   const ret = tokens[0];
//   const args = tokens.slice(1);
//   return { ret, args };
// }

// function readArgByType(argPtr: NativePointer, typeCode: string): any {
//   try {
//     switch (typeCode) {
//       case '@':
//         return isObjCPointer(argPtr) ? new ObjC.Object(argPtr) : argPtr;
//       case ':': {
//         const selStr = ObjC.selectorAsString ? ObjC.selectorAsString(argPtr) : argPtr.toString();
//         return { type: 'SEL', value: selStr };
//       }
//       case 'B':
//       case 'c':
//         return !!argPtr.toInt32();
//       case 'i':
//         return argPtr.toInt32();
//       case 'I':
//         return argPtr.toUInt32();
//       case 's':
//         return argPtr.toInt32();
//       case 'S':
//         return argPtr.toUInt32();
//       case 'l':  // long/NSInteger 在 64 位下不安全，退回 raw
//       case 'q':
//         return { type: 'i64', raw: argPtr.toString() };
//       case 'Q':
//         return { type: 'u64', raw: argPtr.toString() };
//       case 'f':
//       case 'd':
//         return { type: typeCode === 'f' ? 'float' : 'double', raw: argPtr.toString() };
//       case '^v':
//       case '^@':
//       case '^i': case '^q': case '^Q': case '^f': case '^d':
//         return { type: 'pointer', value: argPtr.toString() };
//       default:
//         if (/^[{\[(]/.test(typeCode)) return { type: 'struct', encoding: typeCode, raw: argPtr.toString() };
//         return { type: `unknown(${typeCode})`, raw: argPtr.toString() };
//     }
//   } catch (e) {
//     return { type: `error(${typeCode})`, raw: argPtr.toString(), err: String(e) };
//   }
// }

// function nowISO(): string {
//   try { return new Date().toISOString(); } catch { return ''; }
// }

// function logCall(opts: {
//   cls: string;
//   sel: string;
//   types: TypeSig | null;
//   argsOut?: ArgOut[];
//   retOut?: ArgOut;
//   where: '[ENTER]' | '[LEAVE]';
// }): void {
//   const { cls, sel, types, argsOut, retOut, where } = opts;
//   const head = `[${nowISO()}] ${where} ${cls} ${sel}`;
//   console.log(head);
//   if (types) console.log(`  signature: ret=${types.ret}, args=[${types.args.join(', ')}]`);
//   if (argsOut && argsOut.length) {
//     argsOut.forEach((x, i) => {
//       const label = i === 0 ? 'self' : i === 1 ? '_cmd' : `arg${i - 1}`;
//       console.log(`  ${label}: ${JSON.stringify(toJS(x))}`);
//     });
//   }
//   if (typeof retOut !== 'undefined') {
//     console.log(`  return: ${JSON.stringify(toJS(retOut))}`);
//   }
//   console.log('----');
// }

// function installHook(spec: { cls: string; sel: string }): void {
//   if (!ObjC.available) { console.error('ObjC runtime not available.'); return; }

//   const C = (ObjC.classes as any)[spec.cls] as AnyObjC | undefined;
//   if (!C) { console.error(`Class not found: ${spec.cls}`); return; }

//   const m = (C as any)[spec.sel] as ObjCMethod | undefined;
//   if (!m) { console.error(`Selector not found: ${spec.cls} ${spec.sel}`); return; }

//   const imp = m.implementation as NativePointer;

//   let enc: string | null = null;
//   try { enc = (m as any).types ?? null; } catch { }
//   const sig = parseTypeEncoding(enc);

//   Interceptor.attach(imp, {
//     onEnter(this: InvocationContext, args: NativePointer[]) {
//       const out: ArgOut[] = [];
//       try { out.push(isObjCPointer(args[0]) ? new ObjC.Object(args[0]) : args[0]); } catch { out.push(args[0]); }
//       const selStr = ObjC.selectorAsString ? ObjC.selectorAsString(args[1]) : args[1].toString();
//       out.push({ type: 'SEL', value: selStr });

//       if (sig && sig.args && sig.args.length >= 2) {
//         for (let i = 2; i < sig.args.length; i++) {
//           const t = sig.args[i];
//           const ap = args[i];
//           out.push(readArgByType(ap, t));
//         }
//       } else {
//         for (let i = 2; i < Math.min(8, (args as any).length); i++) {
//           const ap = args[i];
//           out.push(isObjCPointer(ap) ? new ObjC.Object(ap) : ap);
//         }
//       }

//       (this as any).__frida_hook_info = { cls: spec.cls, sel: spec.sel, sig };
//       logCall({ cls: spec.cls, sel: spec.sel, types: sig, argsOut: out, where: '[ENTER]' });
//     },

//     onLeave(this: InvocationContext, retval: NativePointer) {
//       const info = ((this as any).__frida_hook_info || { cls: spec.cls, sel: spec.sel, sig }) as {
//         cls: string; sel: string; sig: TypeSig | null;
//       };
//       const retOut = info.sig && info.sig.ret
//         ? readArgByType(retval, info.sig.ret)
//         : (isObjCPointer(retval) ? new ObjC.Object(retval) : retval);

//       logCall({ cls: info.cls, sel: info.sel, types: info.sig, retOut, where: '[LEAVE]' });
//     }
//   });

//   console.log(`✔ Hooked ${spec.cls} ${spec.sel}${enc ? ` (types="${enc}")` : ''}`);
// }

// export const Hooker = {
//   hook: (spec: { cls: string; sel: string }) => {
//     try { installHook(spec); } catch (e) { console.error('hook error:', e); }
//   },
//   hookMany: (list: Array<{ cls: string; sel: string }>) => {
//     list.forEach(spec => Hooker.hook(spec));
//   },
//   smartHook: (cls: string, selectorName: string) => {
//     const sels = [`- ${selectorName}`, `+ ${selectorName}`];
//     let ok = 0;
//     sels.forEach(sel => {
//       try { installHook({ cls, sel }); ok++; } catch { }
//     });
//     if (!ok) console.error(`smartHook failed for ${cls} ${selectorName}`);
//   }
// };

// // 暴露到全局，方便 Frida REPL 使用
// // @ts-ignore
// (global as any).Hooker = Hooker;

// // 可选示例：自动 hook 某方法（按需取消注释）
// // setImmediate(() => {
// //   Hooker.hook({ cls: 'NSJSONSerialization', sel: '+ JSONObjectWithData:options:error:' });
// // });