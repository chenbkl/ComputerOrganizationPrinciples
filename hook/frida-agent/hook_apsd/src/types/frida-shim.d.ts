// types/frida-shim.d.ts
export {};

declare global {
  // Frida Memory API: readByteArray 在运行时存在，但部分类型包里缺
  interface FridaMemory {
    readByteArray(address: NativePointerValue, size: number): ArrayBuffer | null;
  }
  // 覆盖全局 Memory
  const Memory: FridaMemory & typeof Memory;

  // 某些类型包没有暴露 NativeReturnValue；我们直接把它按 NativePointer 用
  type NativeReturnValue = NativePointer;

  // 一些项目会声明 ObjC.selectorAsString 为可选（?），这里保持可选
  // 若你的 d.ts 已经声明了 ObjC，可忽略这段
  const ObjC: {
    available: boolean;
    classes: Record<string, any>;
    Object: { (ptr: NativePointer): any; new (ptr: NativePointer): any };
    selectorAsString?: (sel: NativePointer) => string;
  };

  // 如果你的 NativePointer 没有 64 位转换方法，声明个“软”方法避免 TS 报错
  interface NativePointer {
    // 仅为通过类型检查；运行期不一定有，建议不要依赖，最好打印 raw 指针
    toInt64?: () => { toNumber(): number; toString(radix?: number): string };
    toUInt64?: () => { toNumber(): number; toString(radix?: number): string };
  }
}