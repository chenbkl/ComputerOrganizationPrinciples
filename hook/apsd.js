// hook-open.js — safe & minimal
(function () {
  'use strict';

  // ===== config =====
  var ENABLE_CF_HOOKS = false;   // 先关掉；需要时改成 true

  // ===== utils =====
  function asInt(x) {
    try {
      if (x && typeof x.toInt32 === 'function') return x.toInt32();
      var n = Number(x); return isNaN(n) ? 0 : n;
    } catch (e) { return 0; }
  }
  function isNullPtr(p) {
    try { return !!(p && typeof p.isNull === 'function' && p.isNull()); }
    catch (_) { return !p; }
  }
  function toObjC(o) { try { return new ObjC.Object(o); } catch (_) { return null; } }

  function readUtf8Preview(ptrBytes, lenLike, limit) {
    if (!limit) limit = 256;
    try {
      if (isNullPtr(ptrBytes)) return '<null-bytes>';
      var n = Math.min(asInt(lenLike), limit);
      if (n <= 0) return '<empty>';
      var s = ptrBytes.readUtf8String(n);
      return s ? s : '<non-utf8>';
    } catch (e) { return '<utf8-failed: ' + e + '>'; }
  }
  function toHex2(n) { var s = n.toString(16); return (s.length < 2 ? '0' : '') + s; }
  function readHexPreview(ptrBytes, lenLike, limit) {
    if (!limit) limit = 64;
    try {
      if (isNullPtr(ptrBytes)) return '<null-bytes>';
      var n = Math.min(asInt(lenLike), limit);
      if (n <= 0) return '';
      var ab = Memory.readByteArray(ptrBytes, n);
      if (!ab) return '<no-bytes>';
      var u8 = new Uint8Array(ab), out = '';
      for (var i = 0; i < u8.length; i++) { out += (i ? ' ' : '') + toHex2(u8[i]); }
      return out;
    } catch (e) { return '<hex-failed: ' + e + '>'; }
  }

  function isNSDataFamily(obj) {
    try { return !!(obj && ObjC.classes && obj.isKindOfClass_(ObjC.classes.NSData)); }
    catch (_) { return false; }
  }
  function nsdataToNSStringMaybe(dataObj) {
    try {
      var NSString = ObjC.classes.NSString;
      function tryEnc(enc) {
        try {
          var s = NSString.alloc().initWithData_encoding_(dataObj, enc);
          if (!s || isNullPtr(s)) return null;
          var sobj = new ObjC.Object(s);
          var out = sobj.toString();
          try { sobj.release && sobj.release(); } catch (_) {}
          return out;
        } catch (_) { return null; }
      }
      return tryEnc(4) || tryEnc(1) || tryEnc(5); // UTF8 / ASCII / Latin1
    } catch (_) { return null; }
  }

  // ===== A) NSString -> NSData (上游拿明文字符串) =====
  (function () {
    if (!ObjC.available) return;
    var S = ObjC.classes.NSString;
    function hook(sel, label) {
      if (!S || !S[sel]) return;
      Interceptor.attach(S[sel].implementation, {
        onEnter: function (args) {
          var s = toObjC(args[0]);
          console.log('\n[NSString ' + label + '] "' + (s ? s.toString() : '<nsstring?>') + '"');
        }
      });
    }
    hook('- dataUsingEncoding:', 'dataUsingEncoding:');
    hook('- dataUsingEncoding:allowLossyConversion:', 'dataUsingEncoding:allowLossyConversion:');
  })();

  // ===== B) 高层序列化 (可读对象) =====
  (function () {
    if (!ObjC.available) return;

    var J = ObjC.classes.NSJSONSerialization;
    if (J && J['+ dataWithJSONObject:options:error:']) {
      Interceptor.attach(J['+ dataWithJSONObject:options:error:'].implementation, {
        onEnter: function (a) {
          var obj = toObjC(a[2]);
          console.log('\n[NSJSONSerialization dataWithJSONObject:] obj=' + (obj ? obj.toString() : '<obj?>'));
        }
      });
    }

    var P = ObjC.classes.NSPropertyListSerialization;
    if (P && P['+ dataWithPropertyList:format:options:error:']) {
      Interceptor.attach(P['+ dataWithPropertyList:format:options:error:'].implementation, {
        onEnter: function (a) {
          var plist = toObjC(a[2]);
          console.log('\n[NSPropertyListSerialization dataWithPropertyList:] plist=' + (plist ? plist.toString() : '<plist?>'));
        }
      });
    }

    var KA = ObjC.classes.NSKeyedArchiver;
    if (KA && KA['+ archivedDataWithRootObject:requiringSecureCoding:error:']) {
      Interceptor.attach(KA['+ archivedDataWithRootObject:requiringSecureCoding:error:'].implementation, {
        onEnter: function (a) {
          var root = toObjC(a[2]);
          console.log('\n[NSKeyedArchiver archivedDataWithRootObject:requiringSecureCoding:error:] root=' + (root ? root.toString() : '<root?>'));
        }
      });
    } else if (KA && KA['+ archivedDataWithRootObject:']) {
      Interceptor.attach(KA['+ archivedDataWithRootObject:'].implementation, {
        onEnter: function (a) {
          var root2 = toObjC(a[2]);
          console.log('\n[NSKeyedArchiver archivedDataWithRootObject:] root=' + (root2 ? root2.toString() : '<root?>'));
        }
      });
    }
  })();

  // ===== C) NSData / NSMutableData 构造与拼接 (覆盖 NSConcreteMutableData) =====
  (function () {
    if (!ObjC.available) return;
    var NSData = ObjC.classes.NSData;
    var NSMutableData = ObjC.classes.NSMutableData;

    function hook(cls, sel, bi, li, tag) {
      if (!cls || !cls[sel]) return;
      Interceptor.attach(cls[sel].implementation, {
        onEnter: function (a) {
          var p = a[bi], l = a[li];
          console.log('\n[' + tag + '] ' + cls.$className + ' ' + sel);
          console.log('    utf8? "' + readUtf8Preview(p, l) + '"');
          console.log('    hex  = ' + readHexPreview(p, l));
        }
      });
    }

    hook(NSData, '- initWithBytes:length:', 2, 3, 'NSData init');
    if (NSData && NSData['- initWithBytesNoCopy:length:freeWhenDone:'])
      hook(NSData, '- initWithBytesNoCopy:length:freeWhenDone:', 2, 3, 'NSData initNoCopy');

    if (NSMutableData && NSMutableData['- appendBytes:length:'])
      hook(NSMutableData, '- appendBytes:length:', 2, 3, 'NSMutableData append');
  })();

  // ===== D) 可选：CoreFoundation CFData 路径 (默认关闭) =====
  (function () {
    if (!ENABLE_CF_HOOKS) return;

    // 旧环境里 Module.findExportByName 可能不可用：做存在性检查
    var findExport = (Module && typeof Module.findExportByName === 'function')
                   ? Module.findExportByName
                   : null;
    if (!findExport) {
      console.log('[CF] skip: Module.findExportByName unavailable');
      return;
    }

    var cfCreate = findExport(null, 'CFDataCreate');
    if (cfCreate) {
      Interceptor.attach(cfCreate, {
        onEnter: function (a) {
          var p = a[2], l = a[3];
          console.log('\n[CFDataCreate] len=' + l);
          console.log('    utf8? "' + readUtf8Preview(p, l) + '"');
          console.log('    hex  = ' + readHexPreview(p, l));
        }
      });
    }

    var cfAppend = findExport(null, 'CFDataAppendBytes');
    if (cfAppend) {
      Interceptor.attach(cfAppend, {
        onEnter: function (a) {
          var p = a[2], l = a[3];
          console.log('\n[CFDataAppendBytes] len=' + l);
          console.log('    utf8? "' + readUtf8Preview(p, l) + '"');
          console.log('    hex  = ' + readHexPreview(p, l));
        }
      });
    }
  })();

  // ===== E) 目标点：APSTCPStream - writeDataInBackground: =====
  (function () {
    if (!ObjC.available) return;
    var C = ObjC.classes.APSTCPStream;
    if (!C || !C['- writeDataInBackground:']) return;
    Interceptor.attach(C['- writeDataInBackground:'].implementation, {
      onEnter: function (a) {
        var d = toObjC(a[2]);
        var cls = d ? d.$className : '<?>';
        console.log('\n[APSTCPStream writeDataInBackground:] dataClass=' + cls);
        try {
          if (d && d.bytes && d.length) {
            var p = d.bytes();
            var l = d.length();
            console.log('    utf8? "' + readUtf8Preview(p, l) + '"');
            console.log('    hex  = ' + readHexPreview(p, l));
          }
        } catch (e) {
          console.log('    <data-inspect-failed: ' + e + '>');
        }
      }
    });
  })();

  console.log('[*] hook-open (safe) loaded');
})();
