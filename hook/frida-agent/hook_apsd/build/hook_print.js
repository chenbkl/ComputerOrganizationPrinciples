"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="frida-gum" />
const frida_objc_bridge_1 = require("frida-objc-bridge");
// export {};
const userInfoSelector = frida_objc_bridge_1.default.classes.APSOutgoingMessage['- userInfo'];
const selectorModule = Process.findModuleByAddress(userInfoSelector.implementation);
console.log('module = ', selectorModule?.name);
