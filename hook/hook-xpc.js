// xpcspy-lite.js
// Works on iOS 64-bit. Attach with: frida -U -n imagent -l xpcspy-lite.js

'use strict';

// ---------- helpers ----------
const PTR = Process.pointerSize;
function addr(mod, sym) {
  const p = Module.findExportByName(mod, sym);
  if (!p) console.log(`[!] ${sym} not found in ${mod || 'all modules'}`);
  return p;
}
function must(fn, name) {
  if (!fn) throw new Error(`missing symbol: ${name}`);
  return fn;
}
function safe(fn) { try { return fn(); } catch (e) { console.log('[xpcspy]', e); } }

const libxpc = 'libxpc.dylib';
const xpc_copy_description_ptr = must(addr(libxpc, 'xpc_copy_description'), 'xpc_copy_description');
const xpc_copy_description = new NativeFunction(xpc_copy_description_ptr, 'pointer', ['pointer']);

const free_ptr = must(addr(null, 'free'), 'free');
const free = new NativeFunction(free_ptr, 'void', ['pointer']);

function xpcDesc(obj) {
  if (obj.isNull()) return '<NULL>';
  const cstr = xpc_copy_description(obj);
  if (cstr.isNull()) return '<NO-DESC>';
  const s = Memory.readUtf8String(cstr);
  free(cstr);
  return s;
}

function head(s, n = 2000) { // 限长避免刷屏
  if (!s) return s;
  return s.length > n ? s.slice(0, n) + ` …(+${s.length - n} chars)` : s;
}

// ---------- hook: outgoing ----------
const sym_send = addr(libxpc, 'xpc_connection_send_message');
const sym_send_with_reply = addr(libxpc, 'xpc_connection_send_message_with_reply');
const sym_send_with_reply_sync = addr(libxpc, 'xpc_connection_send_message_with_reply_sync');

if (sym_send) {
  Interceptor.attach(sym_send, {
    onEnter(args) {
      const conn = args[0];     // xpc_connection_t
      const msg = args[1];     // xpc_object_t (dict, array, etc.)
      safe(() => {
        console.log('\n=== XPC OUT (send_message) ===');
        console.log('[conn]', head(xpcDesc(conn)));
        console.log('[msg ]', head(xpcDesc(msg)));
      });
    }
  });
}

if (sym_send_with_reply) {
  // async 带回调的发送：打印出站消息，并 hook 回复 block 的 invoke
  Interceptor.attach(sym_send_with_reply, {
    onEnter(args) {
      const conn = args[0];
      const msg = args[1];
      const handlerBlock = args[3]; // xpc_handler_t
      safe(() => {
        console.log('\n=== XPC OUT (send_with_reply) ===');
        console.log('[conn]', head(xpcDesc(conn)));
        console.log('[msg ]', head(xpcDesc(msg)));
      });
      hookBlockInvoke(handlerBlock, 'XPC REPLY'); // 打印回复
    }
  });
}

if (sym_send_with_reply_sync) {
  // sync 版本：返回值就是回复
  Interceptor.attach(sym_send_with_reply_sync, {
    onEnter(args) {
      this._conn = args[0];
      this._msg = args[1];
      safe(() => {
        console.log('\n=== XPC OUT (send_with_reply_sync) ===');
        console.log('[conn]', head(xpcDesc(this._conn)));
        console.log('[msg ]', head(xpcDesc(this._msg)));
      });
    },
    onLeave(retval) {
      safe(() => {
        console.log('--- XPC REPLY (sync retval) ---');
        console.log('[reply]', head(xpcDesc(retval)));
      });
    }
  });
}

// ---------- hook: incoming (event handler block) ----------
const sym_set_handler = must(addr(libxpc, 'xpc_connection_set_event_handler'), 'xpc_connection_set_event_handler');
const hookedInvokes = new Set();

function hookBlockInvoke(blockPtr, tag) {
  if (blockPtr.isNull()) return;
  // C block layout (64-bit):
  // struct Block { void *isa; int flags; int reserved; void (*invoke)(void *, ...); void *desc; ... }
  const INVOKE_OFFSET = 16; // 8 (isa) + 4 (flags) + 4 (reserved)
  const invokePtr = Memory.readPointer(blockPtr.add(INVOKE_OFFSET));
  const key = invokePtr.toString();
  if (hookedInvokes.has(key)) return; // 避免重复 attach
  hookedInvokes.add(key);

  Interceptor.attach(invokePtr, {
    onEnter(iargs) {
      // iargs[0] = block_self, iargs[1] = xpc_object_t event
      const event = iargs[1];
      safe(() => {
        console.log(`\n=== ${tag || 'XPC IN'} (event handler) ===`);
        console.log('[event]', head(xpcDesc(event)));
      });
    }
  });
}

Interceptor.attach(sym_set_handler, {
  onEnter(args) {
    const conn = args[0];
    const handler = args[1]; // block*
    safe(() => {
      console.log('\n=== xpc_connection_set_event_handler ===');
      console.log('[conn]', head(xpcDesc(conn)));
    });
    hookBlockInvoke(handler, 'XPC IN');
  }
});

console.log('[xpcspy-lite] hooks installed.');
