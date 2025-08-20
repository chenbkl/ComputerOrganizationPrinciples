"use strict";
/// <reference types="frida-gum" />
/// <reference path="./types/frida-objc.d.ts" />
// export {};
const userInfoSelector = ObjC.classes.APSOutgoingMessage['- userInfo'];
const selectorModule = Process.findModuleByAddress(userInfoSelector.implementation);
console.log('module = ', selectorModule?.name);
