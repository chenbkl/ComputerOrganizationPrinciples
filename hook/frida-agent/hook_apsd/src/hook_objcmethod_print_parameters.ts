

import ObjC from "frida-objc-bridge";

const class_name = "APSTCPStream"; // 目标 Objective-C 类名（字符串）
const selector = "- writeDataInBackground:"; // 目标选择子（实例方法前缀 '-'，类方法则用 '+'）


if (!ObjC.available) {
    console.log('[-] ObjC runtime 不可用，本脚本面向 iOS/macOS。');
    throw new Error('ObjC runtime 不可用');
}

const Cls = ObjC.classes[class_name];
if (!Cls) {
    console.log('[-] 未找到类：' + class_name);
    throw new Error(`未找到类 ${class_name}`);
}
if (!Cls[selector]) {
    console.log(`[-] 未找到方法：[${class_name} ${selector}]`);
    console.log('[*] 可用方法示例：', Cls.$ownMethods.slice(0, 10), '...');
    throw new Error(`未找到方法 ${selector} 在类 ${class_name}`);
}
Interceptor.attach(Cls[selector].implementation, {
    onEnter(args) {
        console.log(`\n[*] Enter [${class_name} ${selector}]`);
        try { console.log('self =', new ObjC.Object(args[0]).toString()); } catch (_) { }
        try { console.log('arg2 =', new ObjC.Object(args[2]).toString()); } catch (_) { }
    },
    onLeave(retval) {
        try {
            const retObj = new ObjC.Object(retval);
            console.log('retval =', retObj.toString());
            if (retObj.$isKindOfClass(ObjC.classes.NSError)) {
                console.log('  错误信息:', retObj.localizedDescription().toString());
            }
            if (retObj.$isKindOfClass(ObjC.classes.NSData)) {
                console.log('  数据长度:', retObj.length);
            }
            if (retObj.$isKindOfClass(ObjC.classes.NSString)) {
                console.log('  字符串内容:', retObj.toString());
            }
            if (retObj.$isKindOfClass(ObjC.classes.NSArray)) {
                console.log('  数组长度:', retObj.count());
                console.log('  数组内容:', retObj.toString());
            }
            if (retObj.$isKindOfClass(ObjC.classes.NSDictionary)) {
                console.log('  字典键值对:', retObj.toString());
            }
            console.log(`[*] Leave [${class_name} ${selector}]`);
        } catch (e) {
            console.error('处理返回值时出错:', e);
            console.log(`[*] Leave [${class_name} ${selector}]`);
        }
    }
}
);
