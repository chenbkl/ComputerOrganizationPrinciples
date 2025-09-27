import { IParsingResult, SupportedBPListFormat } from '../lib/interfaces';
import { objcObjectDebugDesc } from '../lib/helpers';
import {
    xpcGetType,
    xpcDictionaryApply,
    __CFBinaryPlistCreate15,
    xpcDataGetBytesPtr,
    xpcDataGetLength
} from '../lib/systemFunctions';
// import { resourceLimits } from 'worker_threads';
import ObjC from 'frida-objc-bridge';

import { dumpCF } from './parse_bplist15';

export function parseBPListKeysRecursively(
    connection: NativePointer,
    xpcDict: NativePointer
): IParsingResult[] {
    const objType = objcObjectDebugDesc(<NativePointer>xpcGetType.call(xpcDict));
    if (objType != 'OS_xpc_dictionary') { throw Error("Bad object type " + objType); }

    const parsingResult: IParsingResult[] = [];

    /**
     * See: https://developer.apple.com/documentation/xpc/1505404-xpc_dictionary_apply?language=objc
     */
    const block_impl = function (key: NativePointer, value: NativePointer): boolean {
        const valueType = objcObjectDebugDesc(<NativePointer>xpcGetType.call(value));
        switch (valueType) {
            case 'OS_xpc_dictionary':
                parsingResult.push(...parseBPListKeysRecursively(connection, value));
                break;
            case 'OS_xpc_data':
                const length = (xpcDataGetLength.call(value) as number) | 0;
                if (!Number.isFinite(length) || length <= 0) break;

                const bytesPtr = <NativePointer>xpcDataGetBytesPtr.call(value);
                if (bytesPtr.isNull()) break;

                let magic: string | null = null;
                if (length >= 8) {
                    try { magic = bytesPtr.readCString(8); } catch { magic = null; }
                }

                let result: IParsingResult;
                try {
                    if (isKnownBPListData(magic)) {
                        // 如果是已知的 bplist 格式，就直接按格式解析
                        console.log("是已知的bplist格式:", magic, "开始解析");
                        result = parseKnownBPList(bytesPtr, length);
                    } else {
                        // 否则就用 NSXPCDecoder 试着解析
                        // ★ 原来这里把 xpcDict 传进去容易崩，改成当前的 data “value”
                        result = parseGenericBPList(connection, value);
                        if (magic && magic.startsWith('bplist')) {
                            result.format = magic as SupportedBPListFormat;
                        }
                    }
                } catch {
                    break;  // 不把异常抛到顶层，避免终止脚本
                }

                try { result.key = key.readCString() ?? null; } catch { result.key = null; }
                parsingResult.push(result);
                break;
            // const bytesPtr = <NativePointer>xpcDataGetBytesPtr.call(value);
            // const format = bytesPtr.readCString(8);
            // if (format != null && !format.startsWith("bplist")) {
            //     break;
            // }

            // const length = xpcDataGetLength.call(value) as number;
            // let result: IParsingResult;

            // if (isKnownBPListData(format)) {
            //     result = parseKnownBPList(bytesPtr, length);
            // } else {
            //     result = parseGenericBPList(connection, xpcDict);
            //     result.format = format as SupportedBPListFormat;
            // }

            // result.key = key.readCString();
            // parsingResult.push(result);
            // break;
            default:
                break;
        }
        return true;
    }
    const applierBlock = new ObjC.Block({
        implementation: block_impl,
        retType: 'bool',
        argTypes: ['pointer', 'pointer']
    });

    xpcDictionaryApply.call(xpcDict, applierBlock.handle);

    return parsingResult;
}


function parseKnownBPList(
    bytesPtr: NativePointer,
    length: number
): IParsingResult {
    /**
     * Parse binary plist data after detecting its format
     */

    // const bplistFmt = bytesPtr.readCString(8);
    // if (bplistFmt == 'bplist15') {
    //     return {
    //         key: null,
    //         data: objcObjectDebugDesc(<NativePointer>__CFBinaryPlistCreate15.call(bytesPtr, length, ptr(0x0))),
    //         format: 'bplist15'
    //     }
    // } else if (bplistFmt == 'bplist00') {
    // return parseBPlist00(bytesPtr, length);
    // }
    // throw new Error("Unknown bplist format");

    if (bytesPtr.isNull() || !Number.isFinite(length) || length <= 0) {
        return { key: null, data: '<empty>', format: 'bplist15' };
    }

    // 先直接把 bplist 字节按“plist容器”解析
    try {
        const data = ObjC.classes.NSData.dataWithBytes_length_(bytesPtr, length);
        console.log("尝试用 NSPropertyListSerialization 解析...");
        // ① 解析成 Foundation 容器（NSDictionary/NSArray/...）
        const fmtPtr = Memory.alloc(8); fmtPtr.writeU64(0);
        const plistObj = ObjC.classes.NSPropertyListSerialization
            .propertyListWithData_options_format_error_(data, 0, fmtPtr, ptr(0));
        console.log("解析PropertyList成功：", plistObj);
        if (plistObj) {
            console.log("根类型为 Foundation 类:", plistObj.$className());
            // 可选：转成 XML 字符串更易读
            // try {
            //     const xmlData = ObjC.classes.NSPropertyListSerialization
            //         .dataWithPropertyList_format_options_error_(plistObj, 100 /* XML */, 0, ptr(0));
            //     const xmlStr = ObjC.classes.NSString.alloc().initWithData_encoding_(xmlData, 4 /* UTF8 */).toString();
            //     return { key: null, data: xmlStr, format: 'bplist15' };
            // } catch (_) {
            //     // 或直接给出容器的描述
            //     return { key: null, data: objcObjectSafeDesc(plistObj), format: 'bplist15' };
            // }
        }
    } catch (error) {
        console.log("用 NSPropertyListSerialization 解析失败，尝试其他方法...", error);
    }

    // ②（可选）这是 Keyed Archive 的话，再尝试解档成“对象”（先关 secure-coding）
    try {
        console.log("尝试用 NSKeyedUnarchiver 解档...");

        const data = ObjC.classes.NSData.dataWithBytes_length_(bytesPtr, length);
        const un = ObjC.classes.NSKeyedUnarchiver.alloc()['initForReadingWithData:'](data);
        if (un.respondsToSelector_('setRequiresSecureCoding:')) un;
        let obj = un['decodeObjectForKey:']('root') || un['decodeObjectForKey:']('$top') || un['decodeObjectForKey:'](null);
        un['finishDecoding'](); un.release();
        console.log("解档结果：", obj);
        if (obj) return { key: null, data: objcObjectSafeDesc(obj), format: 'bplist15' };
    } catch (error) {
        console.log("用 NSKeyedUnarchiver 解档失败，尝试其他方法...", error);
    }

    // ③ 最后兜底：再试一次 CF 的私有解析 + CF 描述（而不是强行 new ObjC.Object）
    try {
        const cf = <NativePointer>__CFBinaryPlistCreate15.call(bytesPtr, length, ptr(0));

        if (cf.isNull()) return { key: null, data: '<error>', format: 'bplist15' };

        const s = dumpCF(cf, 0);
        // CFRelease(root);

        console.log("尝试用 __CFBinaryPlistCreate15 解析，结果：", s);
        if (!cf.isNull()) return { key: null, data: cfSafeDesc(cf), format: 'bplist15' };
    } catch (_) { }

    return { key: null, data: '<error>', format: 'bplist15' };
}

function objcObjectSafeDesc(ptr: NativePointer): string {
    if (!ptr || ptr.isNull()) return '<null>';
    try {
        const obj = new ObjC.Object(ptr);
        return obj.toString();
    } catch {
        return cfSafeDesc(ptr);
    }
}

const CFCopyDescription = new NativeFunction(Module.findGlobalExportByName('CFCopyDescription')!, 'pointer', ['pointer']);
const CFRelease = new NativeFunction(Module.findGlobalExportByName('CFRelease')!, 'void', ['pointer']);

function cfSafeDesc(ptr: NativePointer): string {
    try {
        const cfStr = CFCopyDescription(ptr);
        if (cfStr.isNull()) return '<cf:null>';
        try {
            return new ObjC.Object(cfStr).toString(); // CFStringRef ↔︎ NSString 橋接
        } finally {
            CFRelease(cfStr);
        }
    } catch {
        return '<cf:unprintable>';
    }
}

function parseGenericBPList(
    connection: NativePointer,
    message: NativePointer
): IParsingResult {
    // const decoder = ObjC.classes.NSXPCDecoder.alloc().init();
    // decoder["- set_connection:"](connection);
    // decoder["- _startReadingFromXPCObject:"](message);

    // /* TODO: return only the data object, let the user provide format and key */
    // const result = {
    //     format: null,
    //     data: decoder.debugDescription(),
    //     key: null,
    // };

    // decoder.dealloc();
    // return result;
    const decoder = ObjC.classes.NSXPCDecoder.alloc().init();
    try {
        decoder['- set_connection:'](connection);
        decoder['- _startReadingFromXPCObject:'](message); // ★ 这里用 value
        return { format: null, data: decoder.debugDescription(), key: null };
    } catch (e) {
        return { format: null, data: `<decoder error: ${String(e)}>`, key: null };
    } finally {
        decoder.dealloc();
    }
}

export function parseBPlist00(bytesPtr: NativePointer, length: number): IParsingResult {
    const data: NativePointer = ObjC.classes.NSData.dataWithBytes_length_(bytesPtr, length);
    const format: NativePointer = Memory.alloc(8);
    format.writeU64(0xaaaaaaaa);

    const plist = ObjC.classes.NSPropertyListSerialization.propertyListWithData_options_format_error_(data, 0, format, ptr(0x0));
    return {
        key: null,
        data: objcObjectDebugDesc(plist),
        format: 'bplist00'
    }
}

function isKnownBPListData(magic: string | null): boolean {
    return magic === "bplist00" || magic === "bplist15";
}
