"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="frida-gum" />
const frida_objc_bridge_1 = require("frida-objc-bridge");
setImmediate(function () {
    /**
     * 作用：在“父方法”执行窗口内，仅记录其“直接子调用”（深度=1）的 ObjC 方法，
     *      从而看到 #0 的“兄弟调用”们（同一父方法直接调用的其它方法）。
     *
     * 用法（任选其一）：
     *   frida -U -n apsd -l siblings-lite.js
     *   frida -p <PID> -l siblings-lite.js
     *
     * 如需替换父方法，请改下面的 PARENT_CLASS / PARENT_SEL。
     */
    // === 配置区 ===
    const PARENT_CLASS = 'APSOutgoingMessage';
    const PARENT_SEL = '- userInfo'; // 你的 #1
    // 是否实时打印（true）或汇总到父方法退出时再打印（false）
    const LIVE_PRINT = true;
    // 实时打印时是否去重
    const DEDUPE_LIVE = false;
    // 忽略一些噪声选择子（可自行增减）
    const NOISY_EXACT = new Set([
        'retain', 'release', 'autorelease', 'dealloc', '.cxx_destruct',
        'respondsToSelector:', 'methodSignatureForSelector:', 'forwardInvocation:',
        'class', 'superclass', 'hash', 'isEqual:', 'description', 'debugDescription'
    ]);
    const NOISY_PREFIX = ['init', 'copy', 'mutableCopy'];
    // === 实现区 ===
    function isNoisy(sel) {
        if (NOISY_EXACT.has(sel))
            return true;
        for (const p of NOISY_PREFIX) {
            if (sel.startsWith(p))
                return true;
        }
        return false;
    }
    if (!frida_objc_bridge_1.default.available) {
        console.log('ObjC not available');
        return; // 现在在函数体内，合法
    }
    const Parent = frida_objc_bridge_1.default.classes[PARENT_CLASS];
    if (!Parent) {
        console.log(`Class not found: ${PARENT_CLASS}`);
        return;
    }
    const parentMethod = Parent[PARENT_SEL];
    if (!parentMethod) {
        console.log(`Selector not found on ${PARENT_CLASS}: ${PARENT_SEL}`);
        return;
    }
    const parentImp = parentMethod.implementation;
    // 维护“父方法窗口”状态：一个线程可能出现嵌套，做成栈更稳妥
    const activeStacks = new Map(); // tid -> [ { depth: 0, counts: Map<string,int>, seen: Set<string> } ]
    function topState(tid) {
        const stack = activeStacks.get(tid);
        if (!stack || stack.length === 0)
            return null;
        return stack[stack.length - 1];
    }
    Interceptor.attach(parentImp, {
        onEnter(args) {
            this.tid = this.threadId;
            let stack = activeStacks.get(this.tid);
            if (!stack) {
                stack = [];
                activeStacks.set(this.tid, stack);
            }
            const state = { depth: 0, counts: new Map(), seen: new Set() };
            stack.push(state);
            console.log(`[ENTER parent] ${PARENT_CLASS} ${PARENT_SEL}`);
        },
        onLeave(retval) {
            const stack = activeStacks.get(this.threadId);
            const state = stack ? stack.pop() : null;
            if (!state)
                return;
            if (!LIVE_PRINT) {
                const rows = Array.from(state.counts.entries()).sort((a, b) => b[1] - a[1]);
                console.log('\n=== Direct children (depth=1) in parent window ===');
                rows.forEach(([k, c]) => console.log(`${c}×  ${k}`));
                console.log('==================================================\n');
            }
            if (stack && stack.length === 0)
                activeStacks.delete(this.threadId);
            console.log('[LEAVE parent]');
        }
    });
    // 通用的 objc_msgSend 钩子（含 super 版本）
    function hookMsgSend(name, isSuper) {
        const addr = Module.findGlobalExportByName(name);
        if (!addr) {
            console.log(`WARN: ${name} not found`);
            return;
        }
        Interceptor.attach(addr, {
            onEnter(args) {
                const st = topState(this.threadId);
                if (!st)
                    return; // 不在父方法窗口
                st.depth++;
                if (st.depth !== 1)
                    return; // 只关心“直接子调用”
                try {
                    //   const sel = ObjC.selectorAsString(args[1] as NativePointer);
                    //   const sel = selToString(args[1] as NativePointer);
                    const sel = selToString(args[1]);
                    if (isNoisy(sel))
                        return;
                    // 取 receiver
                    let recvPtr = args[0];
                    if (isSuper) {
                        // objc_super * -> receiver 在偏移 0
                        recvPtr = args[0].readPointer();
                    }
                    const recv = new frida_objc_bridge_1.default.Object(recvPtr);
                    const cls = recv.$className;
                    const key = `${cls} ${sel}${isSuper ? ' [super]' : ''}`;
                    if (LIVE_PRINT) {
                        if (DEDUPE_LIVE) {
                            if (st.seen.has(key))
                                return;
                            st.seen.add(key);
                        }
                        console.log('  [direct] ' + key);
                    }
                    else {
                        st.counts.set(key, (st.counts.get(key) || 0) + 1);
                    }
                }
                catch (e) {
                    // 非 ObjC 对象或读指针失败，忽略即可
                }
            },
            onLeave(retval) {
                const st = topState(this.threadId);
                if (st)
                    st.depth--;
            }
        });
        console.log(`[hooked] ${name} @ ${addr}`);
    }
    hookMsgSend('objc_msgSend', false);
    hookMsgSend('objc_msgSendSuper2', true);
    console.log('Ready: will list depth=1 ObjC calls during the parent window.');
});
/// <reference types="frida-gum" />
// SEL -> string（超简版）
function selToString(sel) {
    if (!sel || sel.isNull())
        return '<nil>';
    try {
        const objc = Process.getModuleByName('libobjc.A.dylib');
        const p = objc.getExportByName('sel_getName');
        const sel_getName = new NativeFunction(p, 'pointer', ['pointer']);
        const cstr = sel_getName(sel);
        return cstr.isNull() ? '<nil>' : (cstr.readUtf8String() || '<empty>');
    }
    catch {
        return '<unknown_sel>';
    }
}
