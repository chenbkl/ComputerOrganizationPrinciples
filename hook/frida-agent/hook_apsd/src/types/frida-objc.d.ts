/// <reference types="frida-gum" />
export {};

declare global {
  interface ObjCObject { $className: string; toString(): string; }
  interface ObjCMethod { implementation: NativePointer; types?: string; }
  interface ObjCClass {
    $className: string;
    $ownMethods: string[];
    [selector: string]: ObjCMethod | any; // 允许 C['- foo:'] / C['+ bar:']
  }
  const ObjC: {
    available: boolean;
    classes: Record<string, ObjCClass>;
    Object: { new (ptr: NativePointer): ObjCObject };
    selectorAsString?: (sel: NativePointer) => string;
  };
}
