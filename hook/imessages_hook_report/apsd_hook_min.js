// apsd_hooks_min.js  —— macOS 11（Intel，SIP 关闭）
// 用途：在 apsd 内打印 APNs 明文帧（发送/接收）和 connect/filter 生成时的关键材料。

function hex(bytes, limit) {
  const u8 = new Uint8Array(bytes);
  const L = Math.min(u8.length, limit || u8.length);
  let s = '';
  for (let i = 0; i < L; i++) s += ('0' + u8[i].toString(16)).slice(-2);
  return s;
}

if (!ObjC.available) {
  console.log('ObjC not available');
} else {
  const S = ObjC.classes.APSTCPStream;
  const R = ObjC.classes.APSCourier;
  const P = ObjC.classes.APSProtocolParser;

  // 发送侧：TLS 前的明文（包含 opcode 与 APNs 帧）
  if (S && S['- writeDataInBackground:']) {
    Interceptor.attach(S['- writeDataInBackground:'].implementation, {
      onEnter(args) {
        try {
          const data = new ObjC.Object(args[2]); // NSData*
          const len = Number(data.length());
          const ptr = data.bytes();
          const buf = Memory.readByteArray(ptr, Math.min(len, 256));
          const opcode = Memory.readU8(ptr);
          console.log(`[APNS OUT] len=${len} opcode=0x${opcode.toString(16)}`);
          console.log(hex(buf, 256));
        } catch (e) { console.log('OUT err:', e); }
      }
    });
  }

  // 接收侧：TLS 后的明文（可选）
  if (R && R['- tcpStream:dataReceived:']) {
    Interceptor.attach(R['- tcpStream:dataReceived:'].implementation, {
      onEnter(args) {
        try {
          const data = new ObjC.Object(args[3]); // NSData*
          const len = Number(data.length());
          const ptr = data.bytes();
          const buf = Memory.readByteArray(ptr, Math.min(len, 256));
          const opcode = Memory.readU8(ptr);
          console.log(`[APNS IN ] len=${len} opcode=0x${opcode.toString(16)}`);
          console.log(hex(buf, 256));
        } catch (e) { console.log('IN err:', e); }
      }
    });
  }

  // 生成 connect：打印 token / cert / nonce / signature 的长度与前缀
  const selConn = '- copyConnectMessageWithToken:state:presenceFlags:certificate:nonce:signature:redirectCount:lastConnected:disconnectReason:';
  if (P && P[selConn]) {
    Interceptor.attach(P[selConn].implementation, {
      onEnter(args) {
        function dump(label, o) {
          if (o.isNull()) return console.log(`${label}=NULL`);
          const obj = new ObjC.Object(o);
          if (obj.$className.indexOf('NSData') >= 0) {
            const n = Number(obj.length());
            const p = obj.bytes();
            const b = Memory.readByteArray(p, Math.min(n, 16));
            console.log(`${label}=NSData len=${n} head=${hex(b, 16)}`);
          } else {
            console.log(`${label}=${obj.toString()}`);
          }
        }
        console.log('[APNS GEN] connect()');
        dump('token',       args[2]);
        dump('certificate', args[5]);
        dump('nonce',       args[6]);
        dump('signature',   args[7]);
      }
    });
  }

  // 生成 filter：打印 topic 哈希与 token（存在性与前缀）
  const selFilt = '- copyFilterMessageWithEnabledHashes:ignoredHashes:opportunisticHashes:nonWakingHashes:pausedHashes:token:';
  if (P && P[selFilt]) {
    Interceptor.attach(P[selFilt].implementation, {
      onEnter(args) {
        console.log('[APNS GEN] filter()');
        try {
          const enabled = new ObjC.Object(args[2]);
          const arr = enabled.allObjects ? enabled.allObjects() : enabled;
          const cnt = arr.count ? Number(arr.count()) : 0;
          console.log(`enabled_hash_count=${cnt}`);
          if (cnt > 0) {
            const first = new ObjC.Object(arr.objectAtIndex_(0));
            const b = Memory.readByteArray(first.bytes(), Math.min(Number(first.length()), 20));
            console.log(`first_topic_hash=${hex(b, 20)}`);
          }
        } catch (e) { console.log('hash err:', e); }
        try {
          const tok = new ObjC.Object(args[7]);
          const n = Number(tok.length());
          const b = Memory.readByteArray(tok.bytes(), Math.min(n, 16));
          console.log(`token_len=${n} token_head=${hex(b, 16)}`);
        } catch (e) { console.log('token err:', e); }
      }
    });
  }

  console.log('[✓] hooks ready');
}
