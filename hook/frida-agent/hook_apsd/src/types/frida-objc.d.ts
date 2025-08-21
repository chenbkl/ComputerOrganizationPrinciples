// types/frida-objc.d.ts

export {};

declare global {
  interface ObjCObject { $className: string; toString(): string; }
  interface ObjCMethod { implementation: NativePointer; types?: string; }
  interface ObjCClass {
    $className: string;
    $ownMethods: string[];
    [selector: string]: ObjCMethod | any;
  }

  // 关键：既可调用又可用 new
  interface ObjCObjectCtor {
    (ptr: NativePointer): ObjCObject;      // callable
    new (ptr: NativePointer): ObjCObject;  // newable
  }

  const ObjC: {
    available: boolean;
    classes: Record<string, ObjCClass>;
    Object: ObjCObjectCtor;                // 用上面的 ctor 类型
    selectorAsString?: (sel: NativePointer) => string;
  };

  // （可选）如果你喜欢在“类型位”写 ObjC.Object / ObjC.Method：
  namespace ObjC {
    type Object = ObjCObject;
    type Method = ObjCMethod;
    type Class  = ObjCClass;
  }
}