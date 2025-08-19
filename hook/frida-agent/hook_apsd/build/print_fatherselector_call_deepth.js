"use strict";
/// <reference types="frida-gum" />
/// <reference path="./types/frida-objc.d.ts" />
/**
 * trace_calltree_userinfo.ts
 * 在 -[APSOutgoingMessage userInfo] 的“执行窗口内”记录 ObjC 调用树，并在退出时打印。
 *
 * 构建：
 *   frida-compile -o build/trace_calltree_userinfo.js src/trace_calltree_userinfo.ts
 * 运行：
 *   frida -U -n apsd -l build/trace_calltree_userinfo.js
 */
/* ============ 配置 ============ */
const PARENT_CLASS_DEPTH = 'APSOutgoingMessage';
const PARENT_SEL_DEPTH = '- userInfo';
// 最大抓取深度（仅指 ObjC 消息嵌套层级，不含非 ObjC C 函数）；根（userInfo）记为深度 0
const MAX_DEPTH = 5;
// 过滤噪声 selector
const NOISY_EXACT = new Set([
    'retain', 'release', 'autorelease', 'dealloc', '.cxx_destruct',
    'respondsToSelector:', 'methodSignatureForSelector:', 'forwardInvocation:',
    'class', 'superclass', 'hash', 'isEqual:', 'description', 'debugDescription',
    'alloc'
]);
const NOISY_PREFIX = ['init', 'copy', 'mutableCopy'];
// 为了避免巨量输出，可设上限（0 表示不限制）
const MAX_NODES_PER_WINDOW = 0;
/* ============ 实现 ============ */
function isNoisy(sel) {
    if (NOISY_EXACT.has(sel))
        return true;
    for (const p of NOISY_PREFIX)
        if (sel.startsWith(p))
            return true;
    return false;
}
// ——— SEL -> string（优先 ObjC.selectorAsString，兜底 sel_getName）———
const selToString_dep = (() => {
    // 尝试直接用 bridge
    try {
        const f = ObjC.selectorAsString;
        if (typeof f === 'function')
            return (s) => f(s);
    }
    catch { }
    // 兜底：libobjc 的 sel_getName
    let fn = null;
    try {
        const m = Process.getModuleByName('libobjc.A.dylib');
        const p = m.getExportByName('sel_getName');
        fn = new NativeFunction(p, 'pointer', ['pointer']);
    }
    catch { }
    return (s) => {
        if (!fn)
            return '<sel?>';
        try {
            const c = fn(s);
            const str = c.readUtf8String();
            return str || '<sel?>';
        }
        catch {
            return '<sel?>';
        }
    };
})();
const winByTid = new Map();
function topState(tid) {
    const st = winByTid.get(tid);
    return (st && st.length) ? st[st.length - 1] : null;
}
// ——— 打印树 ——•
function printTree(root, indent = '', last = true) {
    const prefix = indent + (indent ? (last ? '└─ ' : '├─ ') : '');
    console.log(prefix + root.sig);
    const nextIndent = indent + (indent ? (last ? '   ' : '│  ') : '');
    const n = root.children.length;
    for (let i = 0; i < n; i++) {
        printTree(root.children[i], nextIndent, i === n - 1);
    }
}
/* ============ 入口：hook 父方法 ============ */
setImmediate(() => {
    if (!ObjC.available) {
        console.log('ObjC not available');
        return;
    }
    const C = ObjC.classes[PARENT_CLASS_DEPTH];
    const M = C?.[PARENT_SEL_DEPTH];
    if (!M) {
        console.log(`Parent not found: [${PARENT_CLASS_DEPTH} ${PARENT_SEL_DEPTH}]`);
        return;
    }
    const parentImp = M.implementation;
    console.log(`[hook] parent [${PARENT_CLASS_DEPTH} ${PARENT_SEL_DEPTH}] types=${M.types}`);
    Interceptor.attach(parentImp, {
        onEnter() {
            const tid = Number(this.threadId);
            let stack = winByTid.get(tid);
            if (!stack) {
                stack = [];
                winByTid.set(tid, stack);
            }
            // 新窗口
            const state = {
                stack: [],
                roots: [],
                msgDepth: 0,
                nodeCount: 0
            };
            // 人工放一个根节点（父方法本身）
            const root = { sig: `${PARENT_CLASS_DEPTH} ${PARENT_SEL_DEPTH}`, children: [] };
            state.roots.push(root);
            state.stack.push(root);
            stack.push(state);
            console.log(`\n[ENTER parent] ${PARENT_CLASS_DEPTH} ${PARENT_SEL_DEPTH}`);
        },
        onLeave() {
            const tid = Number(this.threadId);
            const stack = winByTid.get(tid);
            if (!stack || !stack.length)
                return;
            const state = stack.pop();
            // 打印树（一般只有一个根）
            console.log('--- ObjC call tree within parent window ---');
            for (const r of state.roots)
                printTree(r);
            console.log('-------------------------------------------\n');
            if (!stack.length)
                winByTid.delete(tid);
        }
    });
    // 钩 objc_msgSend / objc_msgSendSuper2
    hookMsgSend('objc_msgSend', false);
    hookMsgSend('objc_msgSendSuper2', true);
});
/* ============ 钩 objc_msgSend ============ */
function hookMsgSend(name, isSuper) {
    let addr = null;
    try {
        addr = Module.findGlobalExportByName(name) || null;
    }
    catch { }
    if (!addr) {
        console.log(`WARN: ${name} not found`);
        return;
    }
    Interceptor.attach(addr, {
        onEnter(args) {
            const tid = Number(this.threadId);
            const st = topState(tid);
            if (!st)
                return; // 不在父窗口内
            // 逻辑“消息深度”+1
            st.msgDepth++;
            // 解析 selector
            let sel = '<sel?>';
            try {
                sel = selToString_dep(args[1]);
            }
            catch { }
            // 是否记录此节点
            const shouldRecord = st.msgDepth <= MAX_DEPTH && !isNoisy(sel) &&
                (MAX_NODES_PER_WINDOW === 0 || st.nodeCount < MAX_NODES_PER_WINDOW);
            this._push = false;
            if (shouldRecord) {
                // 取 receiver（super 的 receiver 在 objc_super* 的第 0 字段）
                let recvPtr = args[0];
                if (isSuper) {
                    try {
                        recvPtr = args[0].readPointer();
                    }
                    catch { }
                }
                let cls = '<?>'; // 尽量拿 className
                try {
                    const o = new ObjC.Object(recvPtr);
                    cls = o.$className || cls;
                }
                catch { }
                const sig = `${cls} ${sel}${isSuper ? ' [super]' : ''}`;
                const node = { sig, children: [] };
                // 挂到当前栈顶
                const parent = st.stack[st.stack.length - 1];
                (parent ? parent.children : st.roots).push(node);
                st.stack.push(node);
                st.nodeCount++;
                this._push = true;
            }
        },
        onLeave() {
            const tid = Number(this.threadId);
            const st = topState(tid);
            if (!st)
                return;
            if (this._push)
                st.stack.pop();
            st.msgDepth--;
        }
    });
    console.log(`[hooked] ${name} @ ${addr}`);
}
