// list_aps.js — 枚举 APS* 类与目标方法
if (!ObjC.available) {
  console.log("Objective-C runtime not available");
  return;
}

// 打印包含关键前缀的类
function listAPSClasses() {
  const wantedPrefixes = ["APS", "APSCourier", "APSTCPStream", "ApplePush"];
  let count = 0;
  for (const name in ObjC.classes) {
    if (wantedPrefixes.some(p => name.indexOf(p) === 0)) {
      console.log(name);
      count++;
    }
  }
  console.log(`\n[+] Total APS-like classes: ${count}`);
}

// 查找包含某个 selector 的类（在 $methods / $ownMethods 字符串里匹配）
function findClassesWithSelector(sel) {
  console.log(`\n[?] Searching selector: ${sel}`);
  for (const name in ObjC.classes) {
    const k = ObjC.classes[name];
    const all = k.$methods; // 包含继承链
    for (let i = 0; i < all.length; i++) {
      if (all[i].indexOf(sel) !== -1) {
        console.log(`  ${name}  ->  ${all[i]}`);
        break;
      }
    }
  }
}

// 打印某类的方法
function dumpClass(klassName) {
  if (!(klassName in ObjC.classes)) {
    console.log(`[!] Class not found: ${klassName}`);
    return;
  }
  const K = ObjC.classes[klassName];
  console.log(`\n### ${klassName}  own methods:`);
  K.$ownMethods.forEach(m => console.log("  " + m));
  console.log(`\n### ${klassName}  all methods:`);
  K.$methods.forEach(m => console.log("  " + m));
}

setImmediate(function () {
  listAPSClasses();
  ["writeDataInBackground:", "tcpStream:dataReceived:", "_connectToServerWithPeerName:"]
    .forEach(findClassesWithSelector);

  // 如存在则打印其方法
  dumpClass("APSCourier");
  dumpClass("APSTCPStream");
});

