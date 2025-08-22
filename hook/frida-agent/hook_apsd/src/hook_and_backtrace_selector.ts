
// /// <reference types="frida-gum" />
// / <reference types="frida-objc-bridge" / >
// import ObjC from "frida-objc-bridge";

// export { };

// // 打印调用栈（发布版常用 FUZZY，帧更全；不够再换 ACCURATE）
// function printBacktrace(ctx: CpuContext, fuzzy = true, max = 32) {         // 定义一个工具函数：根据 CPU 上下文 ctx 打印回溯。
//     const mode = fuzzy ? Backtracer.FUZZY : Backtracer.ACCURATE;
//     // ^^^ Frida 提供：Backtracer 是枚举对象，选择回溯策略：
//     //     - Backtracer.FUZZY   启发式，堆栈更“长”，噪声可能多一些（发布版常用）
//     //     - Backtracer.ACCURATE更精确，依赖帧指针/CFI，优化后可能变短

//     const addrs = Thread.backtrace(ctx, mode);           // NativePointer[]
//     console.log(`\n=== Backtrace (${fuzzy ? 'FUZZY' : 'ACCURATE'}) ===`);
//     for (let i = 0; i < Math.min(addrs.length, max); i++) {
//         const sym = DebugSymbol.fromAddress(addrs[i]);     // DebugSymbolDetails
//         console.log(`#${i} ${sym.toString()}`);            // "module!name+offset" 形式
//     }
//     console.log('====================================\n');      // 分隔线
// }

// // 目标 ObjC 方法（如需修改，改这两行）
// const CLASS_NAME = 'APSTCPStream';                             // 纯 JS：目标 Objective-C 类名（字符串）
// const SELECTOR = '- writeDataInBackground:';                   // 纯 JS：目标选择子（实例方法前缀 '-'，类方法则用 '+'）

// if (!ObjC.available) {                                         // Frida 提供：ObjC 是 Objective-C 运行时桥。
//     // ObjC.available 为布尔值，表示当前进程中是否可使用 ObjC（iOS/macOS 原生 App 一般为 true）。
//     console.log('[-] ObjC runtime 不可用，本脚本面向 iOS/macOS。');
// } else {
//     const Cls = ObjC.classes[CLASS_NAME];
//     // ^^^ Frida 提供：ObjC.classes 是一个“按名称索引的类字典”；
//     //     通过类名获取“类句柄对象”（可用于查询方法、属性等）。

//     if (!Cls) {                                                // 若类不存在，给出提示
//         console.log('[-] 未找到类：' + CLASS_NAME);
//     } else if (!Cls[SELECTOR]) {
//         // ^^^ 这里直接用 Cls['- foo:'] 访问方法描述对象（Method wrapper），不存在则说明该方法不在类上（可能名字不对/分类未加载）
//         console.log(`[-] 未找到方法：[${CLASS_NAME} ${SELECTOR}]`);
//         console.log('[*] 可用方法示例：', Cls.$ownMethods.slice(0, 10), '...');
//         // ^^^ Frida 提供：$ownMethods 是该类“自身实现”的方法名数组（不含父类）。
//         //     用 slice(0,10) 仅展示前 10 项，帮助你核对真实方法名（例如冒号个数）。
//     } else {
//         const impl = Cls[SELECTOR].implementation;
//         // ^^^ Frida：方法描述对象的 .implementation 是该 ObjC 方法的 IMP（NativePointer，真实函数地址）。
//         //     Hook 的本质就是对这个地址做拦截。

//         Interceptor.attach(impl, {
//             // ^^^ Frida 提供：Interceptor 是底层拦截 API。
//             //     .attach(address, callbacks) 在给定地址插入“探针”，当该函数被调用时触发回调。
//             //     回调里 this 含有：
//             //       - this.context  当前线程的 CpuContext（各寄存器）
//             //       - this.returnAddress  调用者返回地址（谁调用了我）
//             //       - this.threadId 当前线程 ID
//             onEnter(args) {
//                 // ^^^ onEnter 在函数“进入时”触发。
//                 //     args 是一个类数组的“参数列表”（NativePointer[]）：
//                 //       ObjC 实例方法：args[0] = self，args[1] = _cmd，args[2] = 第一个形参 ...
//                 //       ObjC 类方法：args[0] = 类对象（meta-class），其余同上。

//                 console.log(`\n[*] Enter [${CLASS_NAME} ${SELECTOR}]`);  // 到达目标方法的提示

//                 // 可选：看看参数，避免崩溃用 try 包一下
//                 try { console.log('self =', new ObjC.Object(args[0]).toString()); } catch (_) { }
//                 // ^^^ Frida：new ObjC.Object(ptr) 用一个指针“包装”为 Objective-C 对象（自动做类型桥接）；
//                 //     .toString() 通常调用 -[NSObject description]，便于友好展示。
//                 //     注意：如果指针不是有效 ObjC 对象会抛异常，所以这里用 try 包裹。

//                 try { console.log('arg2 =', new ObjC.Object(args[2]).toString()); } catch (_) { }
//                 // ^^^ 打印第一个实参（在本方法里通常是 NSData* payload），同样用 try 防止不是对象时崩。

//                 // 打印调用栈（先 FUZZY；若想更精确可改为 false）
//                 printBacktrace(this.context, true);
//                 // ^^^ 关键点：
//                 //     - this.context 由 Frida 注入，代表当前 CPU 寄存器快照（CpuContext）
//                 //     - 传给我们自定义的 printBacktrace，第二个参数 true 表示用 FUZZY 回溯
//             }
//         });
//         console.log(`[*] Hook 成功：[${CLASS_NAME} ${SELECTOR}] ->`, impl);
//         // ^^^ 输出 Hook 成功，并打印被 Hook 的实现地址（NativePointer），便于定位与复核。
//     }
// }
