// who_owns_aps_classes.js
if (!ObjC.available) {
  console.log("Objective-C runtime not available"); return;
}

function imageOfClass(klass) {
  // 利用 ObjC API: const char *class_getImageName(Class cls)
  const p = ObjC.api.class_getImageName(klass.$classHandle);
  return p.isNull() ? "(unknown)" : Memory.readUtf8String(p);
}

["APSTCPStream", "APSCourier"].forEach(name => {
  if (name in ObjC.classes) {
    const K = ObjC.classes[name];
    console.log(`[FOUND] ${name}  in  ${imageOfClass(K)}`);
    // 如需确认方法签名，可顺手打印一下：
    K.$ownMethods.forEach(m => console.log("  " + m));
  } else {
    console.log(`[MISS ] ${name}`);
  }
});

