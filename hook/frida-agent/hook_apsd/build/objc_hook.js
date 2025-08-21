/// <reference path="./types/frida-objc.d.ts" />
/// <reference types="frida-gum" />
/**
 * objc_hook.ts
 * 作用：Hook 指定的 ObjC 方法，按类型尽可能打印入参与返回值。
 * 用法（Frida REPL）：
 *   Hooker.hook({ cls: "APSTCPStream", sel: "- writeDataInBackground:" });
 *   Hooker.hookMany([{ cls: "APSOutgoingMessage", sel: "- userInfo" }]);
 *   Hooker.smartHook("ClassName", "selectorName:withArg:");
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hooker = void 0;
const MAX_DEPTH = 2;
const MAX_ITEMS = 50;
function isNativePointer(v) {
    return v && typeof v === 'object' && typeof v.toString === 'function';
}
function isObjCPointer(p) {
    try {
        if (p.isNull())
            return false;
    }
    catch {
        return false;
    }
    try {
        // 新版 Frida
        // @ts-ignore
        if (ObjC.api && typeof ObjC.api.isObjCObject === 'function') {
            // @ts-ignore
            return ObjC.api.isObjCObject(p);
        }
        // 旧版兼容：尝试构造 ObjC.Object
        new ObjC.Object(p);
        return true;
    }
    catch {
        return false;
    }
}
function toJS(o, depth = 0) {
    if (o === null || o === undefined)
        return o;
    if (isNativePointer(o)) {
        if (o.isNull())
            return { type: 'pointer', value: 'NULL' };
        if (isObjCPointer(o)) {
            try {
                return toJS(new ObjC.Object(o), depth);
            }
            catch { }
        }
        return { type: 'pointer', value: o.toString() };
    }
    const t = typeof o;
    if (t === 'number' || t === 'boolean' || t === 'string')
        return o;
    // ObjC 对象（粗判）
    if (o?.handle instanceof NativePointer) {
        const obj = o;
        const cname = String(obj.$className || 'ObjC.Object');
        const NSString = ObjC.classes.NSString;
        const NSMutableString = ObjC.classes.NSMutableString;
        const NSNumber = ObjC.classes.NSNumber;
        const NSData = ObjC.classes.NSData;
        const NSDate = ObjC.classes.NSDate;
        const NSURL = ObjC.classes.NSURL;
        const NSArray = ObjC.classes.NSArray;
        const NSDictionary = ObjC.classes.NSDictionary;
        const NSSet = ObjC.classes.NSSet;
        const NSError = ObjC.classes.NSError;
        const isKind = (C) => C && obj.isKindOfClass_(C);
        if (isKind(NSString) || isKind(NSMutableString)) {
            try {
                return { type: cname, value: obj.toString() };
            }
            catch {
                return { type: cname, value: String(obj) };
            }
        }
        if (isKind(NSNumber)) {
            try {
                return { type: cname, value: obj.toString() };
            }
            catch {
                return { type: cname, value: String(obj) };
            }
        }
        if (NSData && isKind(NSData)) {
            try {
                const len = Number(obj.length());
                const max = Math.min(64, len);
                const buf = Memory.readByteArray(obj.bytes(), max);
                const hex = buf
                    ? Array.from(new Uint8Array(buf)).map(b => ('0' + b.toString(16)).slice(-2)).join('')
                    : '';
                return { type: `${cname}(${len} bytes)`, previewHex: hex };
            }
            catch {
                return { type: cname, value: obj.toString() };
            }
        }
        if (NSDate && isKind(NSDate)) {
            try {
                return { type: cname, value: obj.toString() };
            }
            catch {
                return { type: cname, value: String(obj) };
            }
        }
        if (NSURL && isKind(NSURL)) {
            try {
                return { type: cname, value: obj.absoluteString().toString() };
            }
            catch {
                return { type: cname, value: obj.toString() };
            }
        }
        if (NSError && isKind(NSError)) {
            try {
                return {
                    type: cname,
                    domain: obj.domain() ? obj.domain().toString() : '',
                    code: obj.code ? Number(obj.code()) : 0,
                    desc: (obj.localizedDescription && obj.localizedDescription()) ? obj.localizedDescription().toString() : ''
                };
            }
            catch {
                return { type: cname, value: obj.toString() };
            }
        }
        if (NSArray && isKind(NSArray)) {
            if (depth >= MAX_DEPTH)
                return { type: cname, value: `Array(depth>${MAX_DEPTH}) size=${Number(obj.count())}` };
            const count = Number(obj.count());
            const limit = Math.min(count, MAX_ITEMS);
            const arr = [];
            for (let i = 0; i < limit; i++) {
                try {
                    arr.push(toJS(obj.objectAtIndex_(i), depth + 1));
                }
                catch {
                    arr.push('<err>');
                }
            }
            if (count > limit)
                arr.push(`... (${count - limit} more)`);
            return { type: cname, size: count, value: arr };
        }
        if (NSSet && isKind(NSSet)) {
            try {
                return toJS(obj.allObjects(), depth);
            }
            catch {
                return { type: cname, value: obj.toString() };
            }
        }
        if (NSDictionary && isKind(NSDictionary)) {
            if (depth >= MAX_DEPTH)
                return { type: cname, value: `Dict(depth>${MAX_DEPTH}) size=${Number(obj.count())}` };
            try {
                const keys = obj.allKeys();
                const kcount = Number(keys.count());
                const limit = Math.min(kcount, MAX_ITEMS);
                const out = {};
                for (let i = 0; i < limit; i++) {
                    const k = keys.objectAtIndex_(i);
                    const v = obj.objectForKey_(k);
                    const keyStr = String(toJS(k, depth + 1).value ?? toJS(k, depth + 1));
                    out[keyStr] = toJS(v, depth + 1);
                }
                if (kcount > limit)
                    out['__more__'] = `${kcount - limit} more`;
                return { type: cname, size: kcount, value: out };
            }
            catch {
                return { type: cname, value: obj.toString() };
            }
        }
        try {
            return { type: cname, value: obj.toString() };
        }
        catch {
            return { type: cname, value: `<${cname} ${obj.handle}>` };
        }
    }
    return String(o);
}
function parseTypeEncoding(enc) {
    if (!enc)
        return null;
    let i = 0;
    function readOne() {
        if (enc == null)
            return null;
        if (i >= enc.length)
            return null;
        const ch = enc[i++];
        if (ch === '^') {
            const inner = readOne();
            return `^${inner ?? '?'}`;
        }
        if (ch === '{' || ch === '(' || ch === '[') {
            const open = ch;
            const close = ch === '{' ? '}' : ch === '(' ? ')' : ']';
            let depth = 1;
            const start = i - 1;
            while (i < enc.length && depth > 0) {
                const c = enc[i++];
                if (c === open)
                    depth++;
                else if (c === close)
                    depth--;
            }
            return enc.slice(start, i);
        }
        if (ch >= '0' && ch <= '9')
            return readOne();
        return ch;
    }
    const tokens = [];
    for (;;) {
        const t = readOne();
        if (!t)
            break;
        tokens.push(t);
    }
    if (tokens.length === 0)
        return null;
    const ret = tokens[0];
    const args = tokens.slice(1);
    return { ret, args };
}
function readArgByType(argPtr, typeCode) {
    try {
        switch (typeCode) {
            case '@':
                return isObjCPointer(argPtr) ? new ObjC.Object(argPtr) : argPtr;
            case ':': {
                const selStr = ObjC.selectorAsString ? ObjC.selectorAsString(argPtr) : argPtr.toString();
                return { type: 'SEL', value: selStr };
            }
            case 'B':
            case 'c':
                return !!argPtr.toInt32();
            case 'i':
                return argPtr.toInt32();
            case 'I':
                return argPtr.toUInt32();
            case 's':
                return argPtr.toInt32();
            case 'S':
                return argPtr.toUInt32();
            case 'l': // long/NSInteger 在 64 位下不安全，退回 raw
            case 'q':
                return { type: 'i64', raw: argPtr.toString() };
            case 'Q':
                return { type: 'u64', raw: argPtr.toString() };
            case 'f':
            case 'd':
                return { type: typeCode === 'f' ? 'float' : 'double', raw: argPtr.toString() };
            case '^v':
            case '^@':
            case '^i':
            case '^q':
            case '^Q':
            case '^f':
            case '^d':
                return { type: 'pointer', value: argPtr.toString() };
            default:
                if (/^[{\[(]/.test(typeCode))
                    return { type: 'struct', encoding: typeCode, raw: argPtr.toString() };
                return { type: `unknown(${typeCode})`, raw: argPtr.toString() };
        }
    }
    catch (e) {
        return { type: `error(${typeCode})`, raw: argPtr.toString(), err: String(e) };
    }
}
function nowISO() {
    try {
        return new Date().toISOString();
    }
    catch {
        return '';
    }
}
function logCall(opts) {
    const { cls, sel, types, argsOut, retOut, where } = opts;
    const head = `[${nowISO()}] ${where} ${cls} ${sel}`;
    console.log(head);
    if (types)
        console.log(`  signature: ret=${types.ret}, args=[${types.args.join(', ')}]`);
    if (argsOut && argsOut.length) {
        argsOut.forEach((x, i) => {
            const label = i === 0 ? 'self' : i === 1 ? '_cmd' : `arg${i - 1}`;
            console.log(`  ${label}: ${JSON.stringify(toJS(x))}`);
        });
    }
    if (typeof retOut !== 'undefined') {
        console.log(`  return: ${JSON.stringify(toJS(retOut))}`);
    }
    console.log('----');
}
function installHook(spec) {
    if (!ObjC.available) {
        console.error('ObjC runtime not available.');
        return;
    }
    const C = ObjC.classes[spec.cls];
    if (!C) {
        console.error(`Class not found: ${spec.cls}`);
        return;
    }
    const m = C[spec.sel];
    if (!m) {
        console.error(`Selector not found: ${spec.cls} ${spec.sel}`);
        return;
    }
    const imp = m.implementation;
    let enc = null;
    try {
        enc = m.types ?? null;
    }
    catch { }
    const sig = parseTypeEncoding(enc);
    Interceptor.attach(imp, {
        onEnter(args) {
            const out = [];
            try {
                out.push(isObjCPointer(args[0]) ? new ObjC.Object(args[0]) : args[0]);
            }
            catch {
                out.push(args[0]);
            }
            const selStr = ObjC.selectorAsString ? ObjC.selectorAsString(args[1]) : args[1].toString();
            out.push({ type: 'SEL', value: selStr });
            if (sig && sig.args && sig.args.length >= 2) {
                for (let i = 2; i < sig.args.length; i++) {
                    const t = sig.args[i];
                    const ap = args[i];
                    out.push(readArgByType(ap, t));
                }
            }
            else {
                for (let i = 2; i < Math.min(8, args.length); i++) {
                    const ap = args[i];
                    out.push(isObjCPointer(ap) ? new ObjC.Object(ap) : ap);
                }
            }
            this.__frida_hook_info = { cls: spec.cls, sel: spec.sel, sig };
            logCall({ cls: spec.cls, sel: spec.sel, types: sig, argsOut: out, where: '[ENTER]' });
        },
        onLeave(retval) {
            const info = (this.__frida_hook_info || { cls: spec.cls, sel: spec.sel, sig });
            const retOut = info.sig && info.sig.ret
                ? readArgByType(retval, info.sig.ret)
                : (isObjCPointer(retval) ? new ObjC.Object(retval) : retval);
            logCall({ cls: info.cls, sel: info.sel, types: info.sig, retOut, where: '[LEAVE]' });
        }
    });
    console.log(`✔ Hooked ${spec.cls} ${spec.sel}${enc ? ` (types="${enc}")` : ''}`);
}
exports.Hooker = {
    hook: (spec) => {
        try {
            installHook(spec);
        }
        catch (e) {
            console.error('hook error:', e);
        }
    },
    hookMany: (list) => {
        list.forEach(spec => exports.Hooker.hook(spec));
    },
    smartHook: (cls, selectorName) => {
        const sels = [`- ${selectorName}`, `+ ${selectorName}`];
        let ok = 0;
        sels.forEach(sel => {
            try {
                installHook({ cls, sel });
                ok++;
            }
            catch { }
        });
        if (!ok)
            console.error(`smartHook failed for ${cls} ${selectorName}`);
    }
};
// 暴露到全局，方便 Frida REPL 使用
// @ts-ignore
global.Hooker = exports.Hooker;
