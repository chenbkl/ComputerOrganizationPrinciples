

import ObjC from "frida-objc-bridge";
import { parseObjCTypes } from "./hook_objcmethod_print_parameters_parseObjcTypes";

const class_name = "APSCourier"; // 目标 Objective-C 类名（字符串）
const selector = "- _sendOutgoingMessage:"; // 目标选择子（实例方法前缀 '-'，类方法则用 '+'）
// -[APSTCPStream serverHostname]
// -[APSCourierConnection serverHostnameForInterface:]
//  UIControl sendAction:to:forEvent:
//  APSTCPStream _connectToServerWithConfiguration:
// [APSOutgoingMessage - userInfo]
// -[APSCourier _sendOutgoingMessage:]
if (!ObjC.available) {
    console.log('[-] ObjC runtime 不可用，本脚本面向 iOS/macOS。');
    throw new Error('ObjC runtime 不可用');
}

const Cls = ObjC.classes[class_name];
if (!Cls) {
    console.log('[-] 未找到类：' + class_name);
    throw new Error(`未找到类 ${class_name}`);
}
console.log("已找到该类：", class_name)
if (!Cls[selector]) {
    console.log(`[-] 未找到方法：[${class_name} ${selector}]`);
    console.log('[*] 可用方法示例：', Cls.$ownMethods.slice(0, 10), '...');
    throw new Error(`未找到方法 ${selector} 在类 ${class_name}`);
}
console.log("已找到该方法：", selector)
Interceptor.attach(Cls[selector].implementation, {
    onEnter(args) {
        console.log(`\n[*] Enter [${class_name} ${selector}]`);

        // dumpAt(args[2], 'sel');
        // dumpAt(args[3], 'obj');

        const m = ObjC.classes[class_name][selector];
        const sig = parseObjCTypes(m.types);
        console.log("入参为：", ObjC.selectorAsString(args[1]));
        printArgs(args, sig);

        // const argument_count = m.argumentTypes.length;
        // if (argument_count <= 2) {
        //     console.log('该方法无参数');
        // } else {
        //     console.log(`该方法有 ${argument_count - 2} 个参数，依次为：`);
        //     for (let i = 2; i < argument_count; i++) {
        //         const type = m.argumentTypes[i];
        //         const arg = args[i];
        //         console.log("第", i - 2, "个参数类型为 =", type)
        //         // 判断是否是 ObjC 对象（通常 `@` 表示对象类型）
        //         if (type === '@') {
        //             console.log("第", i - 2, "个参数类型为 ObjC 对象 地址 =", arg);
        //             const argObj = new ObjC.Object(arg);
        //             dump_print_ObjCobject(argObj);
        //         } else if (type === ':') {
        //             console.log("第", i - 2, "个参数类型为 SEL 选择子 原始值 =", arg);
        //             const sel = ObjC.selectorAsString(arg);
        //             console.log("  选择子字符串 =", sel);
        //         } else {
        //             console.log("第", i - 2, "个参数类型为 =", type, " 原始值 =", arg);
        //         }
        //     }
        // }
    },
    onLeave(retval) {
        try {
            const retObj = new ObjC.Object(retval);
            console.log('返回值类型为 =', retObj.$className, " 地址为 =", retval);
            dump_print_ObjCobject(retObj);
            console.log(`[*] Leave [${class_name} ${selector}]`);
        } catch (e) {
            console.error('处理返回值时出错:', e);
            console.log(`[*] Leave [${class_name} ${selector}]`);
        }
    }
});

/**
 * 根据方法签名打印所有参数的真实值
 * @param {NativePointer[]} args Frida 提供的 args
 * @param {ReturnType<typeof parseObjCTypes>} sig parseObjCTypes() 的结果
 */
function printArgs(args: NativePointer[], sig) {
    sig.args.forEach((a, idx) => {
        const enc = a.enc;
        const friendly = a.friendly;

        let label;
        if (idx === 0) label = "self";
        else if (idx === 1) label = "_cmd";
        else label = `arg${idx - 2}`;

        console.log(`\n[${label}] enc=${enc}, friendly=${friendly}`);

        try {
            if (enc === '@') {
                if (!args[idx].isNull()) {
                    const obj = new ObjC.Object(args[idx]);
                    console.log(`  ObjC object: ${obj.$className} -> ${obj.toString()}`);
                    if (idx >= 2) {
                        dump_print_ObjCobject(obj);
                    }
                } else {
                    console.log("  ObjC object: NULL");
                }
            } else if (enc === ':') {
                console.log("  SEL:", ObjC.selectorAsString(args[idx]));
            } else if (enc === '#') {
                const cls = new ObjC.Object(args[idx]);
                console.log("  Class:", cls.$className);
            } else if (enc === 'c' || enc === 'C') {
                console.log("  char =", args[idx].toInt32());
            } else if (enc === 'i' || enc === 'I' || enc === 's' || enc === 'S' ||
                enc === 'q' || enc === 'Q' || enc === 'l' || enc === 'L') {
                console.log("  int/long =", args[idx].toInt32());
            } else if (enc === 'f') {
                console.log("  float =", args[idx].readFloat());
            } else if (enc === 'd') {
                console.log("  double =", args[idx].readDouble());
            } else if (enc === 'B') {
                console.log("  bool =", args[idx].toInt32() !== 0);
            } else if (enc === '*' || enc === '^c') {
                console.log("  C string =", args[idx].readCString());
            } else if (enc.startsWith('^')) {
                console.log("  pointer =", args[idx], "->", args[idx].readPointer());
            } else {
                console.log("  raw =", args[idx]);
            }
        } catch (e) {
            console.log("  <failed to read>", e);
        }
    });
}

function dump_print_ObjCobject(obj: ObjC.Object) {
    if (obj.isKindOfClass_(ObjC.classes.NSError)) {
        console.log('  错误信息:', obj.localizedDescription().toString());
    }
    if (obj.isKindOfClass_(ObjC.classes.NSData)) {
        console.log('  数据长度:', obj.length);
    }
    if (obj.isKindOfClass_(ObjC.classes.NSString)) {
        console.log('  字符串内容:', obj.toString());
    }
    if (obj.isKindOfClass_(ObjC.classes.NSArray)) {
        console.log('  数组长度:', obj.count());
        console.log('  数组内容:', obj.toString());
    }
    if (obj.isKindOfClass_(ObjC.classes.NSDictionary)) {
        console.log('  字典键值对:', obj.toString());
    }
    console.log("不属于上述NS对象类型，直接打印对象：", obj.toString());
    dump_objcobject_ivars(obj);
}

function safeHexDump(addr, len = 64) {
    try { console.log(hexdump(addr, { offset: 0, length: len, header: false })); }
    catch { console.log('<hexdump failed>'); }
}

function printAsSEL(addr) {
    try {
        const s = ObjC.selectorAsString(addr);
        console.log(`SEL = ${s} @ ${addr}`);
        return true;
    } catch { }
    return false;
}

function printAsObjC(addr) {
    try {
        const o = new ObjC.Object(addr); // 支持 tagged pointer；若不是 ObjC 对象会抛异常
        console.log(`${o.$className} @ ${addr}`);
        // 常见类型友好展示
        if (o.$className === 'NSString') {
            try { console.log(`  NSString: "${o.toString()}"`); } catch { }
        } else if (o.$className === 'NSNumber') {
            try { console.log(`  NSNumber: ${o.toString()}`); } catch { }
        } else if (o.$className === 'NSData') {
            try { console.log(`  NSData length=${o.length().toString()}`); } catch { }
        } else if (o.$className === 'UIEvent') {
            try { console.log(`  UIEvent.type=${o.type().toString()}`); } catch { }
        }
        return true;
    } catch { }
    return false;
}

function printAsCString(addr) {
    try {
        const s = addr.readCString();
        console.log(`char* "${s}" @ ${addr}`);
        return true;
    } catch { }
    return false;
}

/**
 * 通用读取：按提示类型先解；否则按 SEL -> ObjC -> C 字符串 -> 原始 hexdump 的顺序探测
 * hint: 'sel' | 'obj' | 'cstr' | 'raw'
 */
function dumpAt(addr, hint = null) {
    const p = ptr(addr);
    if (p.isNull()) { console.log('NULL'); return; }

    if (hint === 'sel') { if (printAsSEL(p)) return; }
    if (hint === 'obj') { if (printAsObjC(p)) return; }
    if (hint === 'cstr') { if (printAsCString(p)) return; }
    if (hint === 'raw') { safeHexDump(p); return; }

    // 无提示：自动探测
    if (printAsSEL(p)) return;
    if (printAsObjC(p)) return;
    if (printAsCString(p)) return;

    console.log(`raw memory @ ${p}`);
    safeHexDump(p, 96);
}


// —— 辅助：判断是否 Foundation 容器 / 需要递归 ——
function isNSDictionary(o: ObjC.Object) {
    const n = o.$className;
    return n.includes("Dictionary");
}
function isNSArray(o: ObjC.Object) {
    const n = o.$className;
    return n.includes("Array");
}
function isFoundation(o: ObjC.Object) {
    const n = o.$className;
    return n.startsWith("NS") || n.startsWith("__NS") || n === "NSTaggedPointerString";
}
function prettyFoundationScalar(o: ObjC.Object): string {
    const n = o.$className;
    try {
        if (n.includes("String")) return `"${o.toString()}"`;
        if (n.includes("Number") ||
            n.includes("Boolean")) return o.toString();
        if (n.includes("Data")) return `<Data ${o.length()} bytes>`;
        if (n.includes("Date")) return o.toString();
    } catch { }
    return `<${n}>`;
}

// —— 辅助：递归打印 NSDictionary / NSArray ——
function dumpNSDictionary(dict: ObjC.Object, depth = 0, seen = new Set<string>()) {
    const indent = "  ".repeat(depth);
    try {
        const keyArr = dict.allKeys();
        const count = keyArr.count();
        console.log(`${indent}{ // ${dict.$className} count=${count} @ ${dict.handle}`);

        for (let i = 0; i < count; i++) {
            const kObj = new ObjC.Object(keyArr.objectAtIndex_(i));
            const kStr = kObj.toString();
            const vPtr = dict.objectForKey_(kObj); // 直接用 key 对象更稳
            let line = `${indent}  "${kStr}": `;

            try {
                const vObj = new ObjC.Object(vPtr);
                const cls = vObj.$className;

                if (isNSDictionary(vObj)) {
                    console.log(line + `{ /* ${cls} */ }`);
                    dumpNSDictionary(vObj, depth + 2, seen);
                } else if (isNSArray(vObj)) {
                    console.log(line + `[ /* ${cls} count=${vObj.count()} */ ]`);
                    dumpNSArray(vObj, depth + 2, seen);
                } else if (isFoundation(vObj)) {
                    console.log(line + prettyFoundationScalar(vObj));
                } else {
                    console.log(line + `<${cls}> @ ${vObj.handle}`);
                }
            } catch {
                console.log(line + vPtr.toString()); // 非 ObjC
            }
        }
        console.log(indent + "}");
    } catch (e) {
        console.log(`${indent}{ /* unable to dump NSDictionary: ${e} */ }`);
    }
}

function dumpNSArray(arr: ObjC.Object, depth = 0, seen = new Set<string>()) {
    const indent = "  ".repeat(depth);
    try {
        const n = arr.count();
        console.log(`${indent}[ // ${arr.$className} count=${n} @ ${arr.handle}`);
        for (let i = 0; i < n; i++) {
            const vPtr = arr.objectAtIndex_(i);
            let line = `${indent}  [${i}]: `;
            try {
                const vObj = new ObjC.Object(vPtr);
                const cls = vObj.$className;

                if (isNSDictionary(vObj)) {
                    console.log(line + `{ /* ${cls} */ }`);
                    dumpNSDictionary(vObj, depth + 2, seen);
                } else if (isNSArray(vObj)) {
                    console.log(line + `[ /* ${cls} count=${vObj.count()} */ ]`);
                    dumpNSArray(vObj, depth + 2, seen);
                } else if (isFoundation(vObj)) {
                    console.log(line + prettyFoundationScalar(vObj));
                } else {
                    console.log(line + `<${cls}> @ ${vObj.handle}`);
                }
            } catch {
                console.log(line + vPtr.toString());
            }
        }
        console.log(indent + "]");
    } catch (e) {
        console.log(`${indent}[ /* unable to dump NSArray: ${e} */ ]`);
    }
}

// —— 你要的主函数：遍历 $ivars，并对字典类 ivar 递归展开 ——
function dump_objcobject_ivars(obj: ObjC.Object) {
    console.log(`Instance variables of ${obj.$className} @ ${obj.handle}:`);

    let anyDictFound = false;

    try {
        const ivars = obj.$ivars as Record<string, any>;
        const names = Object.keys(ivars);
        if (names.length === 0) {
            console.log("  <no ivars visible via $ivars>");
            return;
        }

        for (const ivarName of names) {
            try {
                const raw = ivars[ivarName];

                // 先把地址打印出来（即使不是对象）
                let header = `  ${ivarName}: `;

                // 尝试当作 ObjC 对象
                let vObj: ObjC.Object | null = null;
                try {
                    vObj = new ObjC.Object(raw);
                } catch {
                    vObj = null;
                }

                if (vObj) {
                    const cls = vObj.$className;
                    // 基本信息
                    console.log(`${header}<${cls}> @ ${vObj.handle}`);

                    // 若是常见 Foundation 标量类，额外打印值
                    if (!isNSDictionary(vObj) && !isNSArray(vObj) && isFoundation(vObj)) {
                        console.log(`    = ${prettyFoundationScalar(vObj)}`);
                    }

                    // 如果是字典或数组，递归展开
                    if (isNSDictionary(vObj)) {
                        anyDictFound = true;
                        dumpNSDictionary(vObj, 2);
                    } else if (isNSArray(vObj)) {
                        dumpNSArray(vObj, 2);
                    }
                } else {
                    // 非 OC 对象（数值/裸指针）
                    console.log(`${header}${String(raw)}`);
                }
            } catch (e) {
                console.log(`  ${ivarName}: <unable to read> (${e})`);
            }
        }

        if (!anyDictFound) {
            console.log("  <no NSDictionary-like ivar found>");
        }
    } catch (e) {
        console.log(`  <failed to access $ivars: ${e}>`);
    }
}