// ===== CF symbol helpers =====
import {
    xpcGetType,
    xpcDictionaryApply,
    __CFBinaryPlistCreate15,
    xpcDataGetBytesPtr,
    xpcDataGetLength
} from '../lib/systemFunctions';
import ObjC from 'frida-objc-bridge';
import { parseBPlist00 } from './parsers';


function sym(mod: string | null, name: string): NativePointer {
    if (mod) return Process.getModuleByName(mod).getExportByName(name);
    return Module.getGlobalExportByName(name); // 全局导出
}

const CF = Process.getModuleByName('CoreFoundation');
CF.ensureInitialized();

// --- CoreFoundation: type-id & getters ---
const CFGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFGetTypeID'), 'ulong', ['pointer']);
const CFDictionaryGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFDictionaryGetTypeID'), 'ulong', []);
const CFArrayGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFArrayGetTypeID'), 'ulong', []);
const CFStringGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFStringGetTypeID'), 'ulong', []);
const CFNumberGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFNumberGetTypeID'), 'ulong', []);
const CFBooleanGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFBooleanGetTypeID'), 'ulong', []);
const CFDateGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFDateGetTypeID'), 'ulong', []);
const CFDataGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFDataGetTypeID'), 'ulong', []);
const CFNullGetTypeID = new NativeFunction(sym('CoreFoundation', 'CFNullGetTypeID'), 'ulong', []);

// --- CF Utilities ---
const CFCopyDescription = new NativeFunction(sym('CoreFoundation', 'CFCopyDescription'), 'pointer', ['pointer']);
const CFRelease = new NativeFunction(sym('CoreFoundation', 'CFRelease'), 'void', ['pointer']);
const CFDictionaryApplyFunction = new NativeFunction(sym('CoreFoundation', 'CFDictionaryApplyFunction'), 'void', ['pointer', 'pointer', 'pointer']);
const CFDictionaryGetCount = new NativeFunction(sym('CoreFoundation', 'CFDictionaryGetCount'), 'long', ['pointer']);
const CFArrayGetCount = new NativeFunction(sym('CoreFoundation', 'CFArrayGetCount'), 'long', ['pointer']);
const CFArrayGetValueAtIndex = new NativeFunction(sym('CoreFoundation', 'CFArrayGetValueAtIndex'), 'pointer', ['pointer', 'long']);
const CFBooleanGetValue = new NativeFunction(sym('CoreFoundation', 'CFBooleanGetValue'), 'bool', ['pointer']);
const CFNumberGetValue = new NativeFunction(sym('CoreFoundation', 'CFNumberGetValue'), 'bool', ['pointer', 'int', 'pointer']);
const CFDateGetAbsoluteTime = new NativeFunction(sym('CoreFoundation', 'CFDateGetAbsoluteTime'), 'double', ['pointer']);
const CFDataGetLength = new NativeFunction(sym('CoreFoundation', 'CFDataGetLength'), 'long', ['pointer']);
const CFDataGetBytePtr = new NativeFunction(sym('CoreFoundation', 'CFDataGetBytePtr'), 'pointer', ['pointer']);


// ===== Type check =====
function cfTypeOf(obj: NativePointer): string {
    const tid = Number(CFGetTypeID(obj));
    if (tid === Number(CFDictionaryGetTypeID())) return 'CFDictionary';
    if (tid === Number(CFArrayGetTypeID())) return 'CFArray';
    if (tid === Number(CFStringGetTypeID())) return 'CFString';
    if (tid === Number(CFNumberGetTypeID())) return 'CFNumber';
    if (tid === Number(CFBooleanGetTypeID())) return 'CFBoolean';
    if (tid === Number(CFDateGetTypeID())) return 'CFDate';
    if (tid === Number(CFDataGetTypeID())) return 'CFData';
    if (tid === Number(CFNullGetTypeID())) return 'CFNull';
    return 'Unknown';
}

// ===== CFString 转 JS string（尽量稳）=====
function cfStringToJs(s: NativePointer): string {
    try { return new ObjC.Object(s).toString(); } catch { }
    // 兜底：CFCopyDescription 再桥接
    try {
        const desc = CFCopyDescription(s);
        if (!desc.isNull()) {
            try { return new ObjC.Object(desc).toString(); } finally { CFRelease(desc); }
        }
    } catch { }
    return '<CFString>';
}

// ===== CFNumber 取值（优先 64 位，失败再退到 double）=====
function cfNumberToJs(n: NativePointer): string {
    const buf = Memory.alloc(8);
    // kCFNumberSInt64Type 在 Apple 平台是 4（通常如此），如果不放心可尝试多种 CFNumberType
    const kCFNumberSInt64Type = 4;
    if (CFNumberGetValue(n, kCFNumberSInt64Type, buf)) {
        return buf.readS64().toString();
    }
    // 退到 double：kCFNumberFloat64Type = 6（常见）
    const kCFNumberFloat64Type = 6;
    if (CFNumberGetValue(n, kCFNumberFloat64Type, buf)) {
        return buf.readDouble().toString();
    }
    return '<CFNumber>';
}

// ===== CFDate 打印（相对 2001-01-01 参考）=====
function cfDateToJs(d: NativePointer): string {
    const secs2001 = CFDateGetAbsoluteTime(d) as number;
    return `CFDate(${secs2001}s since 2001-01-01)`;
}

// ===== CFData 打印（可选 bplist 再解析）=====
interface DumpOptions {
    maxHex?: number;        // CFData 十六进制预览的最大字节数
    tryBPlist?: boolean;    // 如检测到 'bplist'，是否递归解析
    maxDepth?: number;      // 最大递归深度
}

const DEFAULT_OPTS: Required<DumpOptions> = { maxHex: 256, tryBPlist: true, maxDepth: 16 };

function cfDataPreview(data: NativePointer, opts = DEFAULT_OPTS): string {
    const len = Number(CFDataGetLength(data));
    const p = CFDataGetBytePtr(data) as NativePointer;
    const n = Math.min(len, opts.maxHex);
    const ab = n > 0 ? (p.readByteArray(n) as ArrayBuffer) : new ArrayBuffer(0);
    const hex = Buffer.from(new Uint8Array(ab)).toString('hex');

    // bplist 头检测
    if (opts.tryBPlist && len >= 8) {
        const magic = p.readCString(8);
        if (magic && magic.startsWith('bplist') && __CFBinaryPlistCreate15) {
            try {
                const cfPlist = <NativePointer>__CFBinaryPlistCreate15.call(p, len, ptr(0));
                if (!cfPlist.isNull()) {
                    const pretty = dumpCF(cfPlist, 0, opts); // 递归打印
                    CFRelease(cfPlist);
                    return `<CFData len=${len} (bplist)> ` + pretty;
                }
            } catch { }
        }
    }
    return `<CFData len=${len} hex[0..${n}]=${hex}>`;
}

function previewCFDataSmart(cfData: NativePointer): string {
    const len = Number(CFDataGetLength(cfData));
    const p = CFDataGetBytePtr(cfData) as NativePointer;
    if (len <= 0 || p.isNull()) return `<CFData len=${len}>`;

    // 1) bplist?

    if (len >= 8) {
        const magic = p.readCString(8);
        if (magic && magic.startsWith('bplist15') && __CFBinaryPlistCreate15) {
            try {
                const plist = <NativePointer>__CFBinaryPlistCreate15.call(p, len, ptr(0));
                if (!plist.isNull()) {
                    const pretty = dumpCF(plist, 0, { maxHex: 256, tryBPlist: true, maxDepth: 8 });
                    CFRelease(plist);
                    return `<CFData len=${len} (bplist)> ${pretty}`;
                }
            } catch { }
        } else if (magic && magic.startsWith('bplist00')) {
            return `<CFData len=${len} (bplist)> ${parseBPlist00(cfData, len).data}`;
        }

    }

    // 2) UTF-8 文本 / C 字符串（包含可能的 \0）
    const maxProbe = Math.min(len, 128);
    const ab = p.readByteArray(maxProbe) as ArrayBuffer;
    const u8 = new Uint8Array(ab);

    const looksPrintable = u8.every(b => b === 0 || (b >= 0x20 && b <= 0x7e));
    if (looksPrintable) {
        // 尝试按 UTF-8 直接构造 NSString
        try {
            const NSString = ObjC.classes.NSString;
            const s = NSString.alloc().initWithBytes_length_encoding_(p, len, 4 /*UTF8*/).toString();
            // 一些典型注释：方法类型编码
            if (/^[vViIQLqBcfds@:#\?0-9]+$/.test(s.replace(/\0+$/, ''))) {
                return `<CFData len=${len} ascii="${s}" (ObjC type encoding?)>`;
            }
            return `<CFData len=${len} utf8="${s}">`;
        } catch { }
        // 退化成 C 字符串（到第一个 \0）
        try {
            const s0 = p.readCString();
            if (s0 && s0.length > 0) return `<CFData len=${len} cstr="${s0}">`;
        } catch { }
    }

    // 3) UUID（16 字节）
    if (len === 16) {
        const bytes = (p.readByteArray(16) as ArrayBuffer);
        const b = Buffer.from(new Uint8Array(bytes));
        // Apple 常规 UUID 字节序（不纠结大小端细节，直接输出常见格式）
        const hex = b.toString('hex');
        const uuid = [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20)
        ].join('-');
        return `<CFData len=16 uuid=${uuid}>`;
    }

    // 4) 小长度：给十六进制 + ASCII 对照
    if (len <= 8) {
        const hex = Buffer.from(u8).toString('hex');
        const ascii = Array.from(u8).map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
        return `<CFData len=${len} hex=${hex} ascii="${ascii}">`;
    }

    // 5) 默认十六进制预览 + Base64（截断）
    const preview = Math.min(len, 256);
    const abFull = p.readByteArray(preview) as ArrayBuffer;
    const hex = Buffer.from(new Uint8Array(abFull)).toString('hex');
    const b64 = Buffer.from(new Uint8Array(abFull)).toString('base64');
    return `<CFData len=${len} hex[0..${preview}]=${hex} b64[0..${preview}]=${b64}>`;
}

// function parseBPlist00(bytesPtr: NativePointer, length: number): string {
//     const NSData = ObjC.classes.NSData;
//     const NSPropertyListSerialization = ObjC.classes.NSPropertyListSerialization;
//     const NSString = ObjC.classes.NSString;

//     const data = NSData.dataWithBytes_length_(bytesPtr, length);

//     const fmtPtr = Memory.alloc(8);
//     fmtPtr.writeU64(0);

//     // 解析成 Foundation 容器
//     const plistObj = NSPropertyListSerialization
//         .propertyListWithData_options_format_error_(data, 0, fmtPtr, ptr(0));

//     if (plistObj.isNull()) {
//         return "<parse failed>";
//     }

//     // 转成 XML 方便查看
//     try {
//         const xmlData = NSPropertyListSerialization
//             .dataWithPropertyList_format_options_error_(plistObj, 100 /* XML 格式 */, 0, ptr(0));
//         const xmlStr = NSString.alloc().initWithData_encoding_(xmlData, 4 /* UTF8 */).toString();
//         return xmlStr;
//     } catch (_) {
//         return new ObjC.Object(plistObj).toString();
//     }
// }

// ===== 递归打印主函数 =====
export function dumpCF(obj: NativePointer, depth = 0, options?: DumpOptions): string {
    const opts = { ...DEFAULT_OPTS, ...(options ?? {}) };
    if (depth > opts.maxDepth) return '...<max depth>...';

    const indent = '  '.repeat(depth);
    const t = cfTypeOf(obj);

    switch (t) {
        case 'CFDictionary': {
            let out = indent + '{\n';
            const applier = new ObjC.Block({
                retType: 'void',
                argTypes: ['pointer', 'pointer', 'pointer'],
                implementation: (k: NativePointer, v: NativePointer, _ctx: NativePointer) => {
                    out += `${indent}  ${dumpCF(k, 0, opts)} : ${dumpCF(v, depth + 1, opts)}\n`;
                }
            });
            CFDictionaryApplyFunction(obj, applier.handle, ptr(0));
            return out + indent + '}';
        }

        case 'CFArray': {
            const n = Number(CFArrayGetCount(obj));
            let out = indent + '[\n';
            for (let i = 0; i < n; i++) {
                const elem = CFArrayGetValueAtIndex(obj, i) as NativePointer;
                out += dumpCF(elem, depth + 1, opts) + '\n';
            }
            return out + indent + ']';
        }

        case 'CFString':
            return indent + JSON.stringify(cfStringToJs(obj)); // JSON 转义更安全

        case 'CFNumber':
            return indent + cfNumberToJs(obj);

        case 'CFBoolean':
            return indent + (CFBooleanGetValue(obj) ? 'true' : 'false');

        case 'CFDate':
            return indent + cfDateToJs(obj);

        case 'CFData':
            return indent + previewCFDataSmart(obj);

        case 'CFNull':
            return indent + 'null';

        default: {
            // 尝试描述字符串兜底
            try {
                const d = CFCopyDescription(obj);
                if (!d.isNull()) {
                    try { return indent + new ObjC.Object(d).toString(); }
                    finally { CFRelease(d); }
                }
            } catch { }
            return indent + '<Unknown CFType>';
        }
    }
}

// ===== 示例：从 bplist bytes 直接 dump 根对象 =====
export function dumpBPlist(bytesPtr: NativePointer, length: number, opts?: DumpOptions): string {
    if (!__CFBinaryPlistCreate15) return '<__CFBinaryPlistCreate15 not available>';
    try {
        const root = <NativePointer>__CFBinaryPlistCreate15.call(bytesPtr, length, ptr(0));
        if (root.isNull()) return '<parse failed>';
        const s = dumpCF(root, 0, opts);
        CFRelease(root);
        return s;
    } catch (e) {
        return `<parse error: ${String(e)}>`;
    }
}