/// <reference types="frida-gum" />
import ObjC from "frida-objc-bridge";

// export {};

const userInfoSelector = ObjC.classes.APSOutgoingMessage['- userInfo']
const selectorModule = Process.findModuleByAddress(userInfoSelector.implementation)
console.log('module = ', selectorModule?.name)
