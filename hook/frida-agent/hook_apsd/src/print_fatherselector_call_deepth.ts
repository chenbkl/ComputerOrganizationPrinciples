/// <reference types="frida-gum" />
/// <reference types="./types/frida-objc.d.ts" />

setImmediate(function () {
  // === 配置区 ===
  const PARENT_CLASS = 'APSCourier';
  const PARENT_SEL   = '- _sendOutgoingMessage:';

  // 最大抓取深度：根（userInfo）记为 0 层，直接子调用为 1 层
  const MAX_DEPTH = 5;

  // 噪声过滤
  const NOISY_EXACT = new Set([
    'retain', 'release', 'autorelease', 'dealloc', '.cxx_destruct',
    'respondsToSelector:', 'methodSignatureForSelector:', 'forwardInvocation:',
    'class', 'superclass', 'hash', 'isEqual:', 'description', 'debugDescription',
    'alloc'
  ]);
  const NOISY_PREFIX = ['init', 'copy', 'mutableCopy'];

  // 每个窗口最多记录多少节点（0 表示不限制，避免爆量）
  const MAX_NODES_PER_WINDOW = 0;

  function isNoisy(sel: string) {
    if (NOISY_EXACT.has(sel)) return true;
    for (const p of NOISY_PREFIX) if (sel.startsWith(p)) return true;
    return false;
  }

  if (!ObjC.available) { console.log('ObjC not available'); return; }

  const Parent = ObjC.classes[PARENT_CLASS];
  if (!Parent) { console.log(`Class not found: ${PARENT_CLASS}`); return; }
  const parentMethod = Parent[PARENT_SEL];
  if (!parentMethod) { console.log(`Selector not found on ${PARENT_CLASS}: ${PARENT_SEL}`); return; }
  const parentImp = parentMethod.implementation;

  // ===== 调用树结构 =====
  type Node = { sig: string; children: Node[] };
  type State = {
    stack: Node[];     // 当前 node 栈（栈顶是“当前父节点”）
    roots: Node[];     // 通常只有一个根：parent 本身
    msgDepth: number;  // objc_msgSend 嵌套深度（进入+1，退出-1）
    nodeCount: number; // 限流计数
  };

  const winByTid = new Map<number, State[]>(); // tid -> 窗口栈（支持嵌套）
  function topState(tid: number): State | null {
    const s = winByTid.get(tid);
    return (s && s.length) ? s[s.length - 1] : null;
  }

  function printTree(root: Node, indent = '', last = true): void {
    const prefix = indent + (indent ? (last ? '└─ ' : '├─ ') : '');
    console.log(prefix + root.sig);
    const nextIndent = indent + (indent ? (last ? '   ' : '│  ') : '');
    const n = root.children.length;
    for (let i = 0; i < n; i++) {
      printTree(root.children[i], nextIndent, i === n - 1);
    }
  }

  // ===== 进入/退出 父窗口 =====
  Interceptor.attach(parentImp, {
    onEnter() {
      const tid = Number(this.threadId);
      let stack = winByTid.get(tid);
      if (!stack) { stack = []; winByTid.set(tid, stack); }

      const state: State = { stack: [], roots: [], msgDepth: 0, nodeCount: 0 };
      const root: Node = { sig: `${PARENT_CLASS} ${PARENT_SEL}`, children: [] };
      state.roots.push(root);
      state.stack.push(root);
      stack.push(state);

      console.log(`\n[ENTER parent] ${PARENT_CLASS} ${PARENT_SEL}`);
    },
    onLeave() {
      const tid = Number(this.threadId);
      const stack = winByTid.get(tid);
      if (!stack || !stack.length) return;
      const state = stack.pop() as State;

      console.log('--- ObjC call tree within parent window ---');
      for (const r of state.roots) printTree(r);
      console.log('-------------------------------------------\n');

      if (!stack.length) winByTid.delete(tid);
    }
  });

  // ===== 钩 objc_msgSend / objc_msgSendSuper2，构建调用树 =====
  hookMsgSend('objc_msgSend', false);
  hookMsgSend('objc_msgSendSuper2', true);

  function hookMsgSend(name: string, isSuper: boolean) {
    const addr = Module.findGlobalExportByName(name);
    if (!addr) { console.log(`WARN: ${name} not found`); return; }

    Interceptor.attach(addr, {
      onEnter(args) {
        const tid = Number(this.threadId);
        const st = topState(tid);
        if (!st) return;          // 不在父窗口内

        // 深度+1（进入一个 ObjC 调用）
        st.msgDepth++;

        // 仅在限制深度内记录
        if (st.msgDepth > MAX_DEPTH) return;
        if (MAX_NODES_PER_WINDOW && st.nodeCount >= MAX_NODES_PER_WINDOW) return;

        // 解析 selector
        let sel = '<sel?>';
        try { sel = selToString(args[1] as NativePointer); } catch {}
        if (isNoisy(sel)) return;

        // 取 receiver，super 时从 objc_super* 解出 receiver
        let recvPtr = args[0] as NativePointer;
        if (isSuper) {
          try { recvPtr = (args[0] as NativePointer).readPointer(); } catch {}
        }
        let cls = '<?>';
        try { cls = new ObjC.Object(recvPtr).$className || cls; } catch {}

        const sig = `${cls} ${sel}${isSuper ? ' [super]' : ''}`;
        const node: Node = { sig, children: [] };

        // 挂到当前父节点
        const parent = st.stack[st.stack.length - 1];
        if (parent) parent.children.push(node); else st.roots.push(node);

        // 把当前节点入栈，等待它的子调用
        st.stack.push(node);
        st.nodeCount++;
        (this as any)._pushed = true;
      },
      onLeave() {
        const tid = Number(this.threadId);
        const st = topState(tid);
        if (!st) return;

        if ((this as any)._pushed) st.stack.pop();
        st.msgDepth--; // 退出一个 ObjC 调用
      }
    });

    console.log(`[hooked] ${name} @ ${addr}`);
  }

  console.log(`Ready: will build ObjC call tree up to depth=${MAX_DEPTH} during the parent window.`);
});

// ===== SEL -> string（沿用你的实现） =====
function selToString(sel: NativePointer): string {
  if (!sel || sel.isNull()) return '<nil>';
  try {
    const objc = Process.getModuleByName('libobjc.A.dylib');
    const p = objc.getExportByName('sel_getName');
    const sel_getName = new NativeFunction(p, 'pointer', ['pointer']) as (s: NativePointer) => NativePointer;
    const cstr = sel_getName(sel);
    return cstr.isNull() ? '<nil>' : (cstr.readUtf8String() || '<empty>');
  } catch {
    return '<unknown_sel>';
  }
}