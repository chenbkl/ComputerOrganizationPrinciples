📦
169100 /agent/src/index.js
113354 /agent/src/index.js.map
✄
// frida-shim:node_modules/@frida/base64-js/index.js
var lookup = [];
var revLookup = [];
var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i];
  revLookup[code.charCodeAt(i)] = i;
}
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
function getLens(b64) {
  const len = b64.length;
  if (len % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  let validLen = b64.indexOf("=");
  if (validLen === -1) validLen = len;
  const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
}
function _byteLength(b64, validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}
function toByteArray(b64) {
  const lens = getLens(b64);
  const validLen = lens[0];
  const placeHoldersLen = lens[1];
  const arr = new Uint8Array(_byteLength(b64, validLen, placeHoldersLen));
  let curByte = 0;
  const len = placeHoldersLen > 0 ? validLen - 4 : validLen;
  let i;
  for (i = 0; i < len; i += 4) {
    const tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr[curByte++] = tmp >> 16 & 255;
    arr[curByte++] = tmp >> 8 & 255;
    arr[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 2) {
    const tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 1) {
    const tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr[curByte++] = tmp >> 8 & 255;
    arr[curByte++] = tmp & 255;
  }
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  const output = [];
  for (let i = start; i < end; i += 3) {
    const tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
    output.push(tripletToBase64(tmp));
  }
  return output.join("");
}
function fromByteArray(uint8) {
  const len = uint8.length;
  const extraBytes = len % 3;
  const parts = [];
  const maxChunkLength = 16383;
  for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  }
  if (extraBytes === 1) {
    const tmp = uint8[len - 1];
    parts.push(
      lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
    );
  } else if (extraBytes === 2) {
    const tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(
      lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
    );
  }
  return parts.join("");
}

// frida-shim:node_modules/@frida/ieee754/index.js
function read(buffer, offset, isLE, mLen, nBytes) {
  let e, m2;
  const eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  let nBits = -7;
  let i = isLE ? nBytes - 1 : 0;
  const d = isLE ? -1 : 1;
  let s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  while (nBits > 0) {
    e = e * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }
  m2 = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  while (nBits > 0) {
    m2 = m2 * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m2 ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m2 = m2 + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m2 * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  let e, m2, c;
  let eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  const rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  let i = isLE ? 0 : nBytes - 1;
  const d = isLE ? 1 : -1;
  const s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);
  if (isNaN(value) || value === Infinity) {
    m2 = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }
    if (e + eBias >= eMax) {
      m2 = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m2 = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m2 = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }
  while (mLen >= 8) {
    buffer[offset + i] = m2 & 255;
    i += d;
    m2 /= 256;
    mLen -= 8;
  }
  e = e << mLen | m2;
  eLen += mLen;
  while (eLen > 0) {
    buffer[offset + i] = e & 255;
    i += d;
    e /= 256;
    eLen -= 8;
  }
  buffer[offset + i - d] |= s * 128;
}

// frida-shim:node_modules/@frida/buffer/index.js
var config = {
  INSPECT_MAX_BYTES: 50
};
var K_MAX_LENGTH = 2147483647;
Buffer.TYPED_ARRAY_SUPPORT = true;
Object.defineProperty(Buffer.prototype, "parent", {
  enumerable: true,
  get: function() {
    if (!Buffer.isBuffer(this)) return void 0;
    return this.buffer;
  }
});
Object.defineProperty(Buffer.prototype, "offset", {
  enumerable: true,
  get: function() {
    if (!Buffer.isBuffer(this)) return void 0;
    return this.byteOffset;
  }
});
function createBuffer(length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"');
  }
  const buf = new Uint8Array(length);
  Object.setPrototypeOf(buf, Buffer.prototype);
  return buf;
}
function Buffer(arg, encodingOrOffset, length) {
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string") {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      );
    }
    return allocUnsafe(arg);
  }
  return from(arg, encodingOrOffset, length);
}
Buffer.poolSize = 8192;
function from(value, encodingOrOffset, length) {
  if (typeof value === "string") {
    return fromString(value, encodingOrOffset);
  }
  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value);
  }
  if (value == null) {
    throw new TypeError(
      "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
    );
  }
  if (value instanceof ArrayBuffer || value && value.buffer instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length);
  }
  if (value instanceof SharedArrayBuffer || value && value.buffer instanceof SharedArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length);
  }
  if (typeof value === "number") {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    );
  }
  const valueOf = value.valueOf && value.valueOf();
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length);
  }
  const b = fromObject(value);
  if (b) return b;
  if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
    return Buffer.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
  }
  throw new TypeError(
    "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
  );
}
Buffer.from = function(value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length);
};
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
Object.setPrototypeOf(Buffer, Uint8Array);
function assertSize(size) {
  if (typeof size !== "number") {
    throw new TypeError('"size" argument must be of type number');
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"');
  }
}
function alloc(size, fill2, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(size);
  }
  if (fill2 !== void 0) {
    return typeof encoding === "string" ? createBuffer(size).fill(fill2, encoding) : createBuffer(size).fill(fill2);
  }
  return createBuffer(size);
}
Buffer.alloc = function(size, fill2, encoding) {
  return alloc(size, fill2, encoding);
};
function allocUnsafe(size) {
  assertSize(size);
  return createBuffer(size < 0 ? 0 : checked(size) | 0);
}
Buffer.allocUnsafe = function(size) {
  return allocUnsafe(size);
};
Buffer.allocUnsafeSlow = function(size) {
  return allocUnsafe(size);
};
function fromString(string, encoding) {
  if (typeof encoding !== "string" || encoding === "") {
    encoding = "utf8";
  }
  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError("Unknown encoding: " + encoding);
  }
  const length = byteLength(string, encoding) | 0;
  let buf = createBuffer(length);
  const actual = buf.write(string, encoding);
  if (actual !== length) {
    buf = buf.slice(0, actual);
  }
  return buf;
}
function fromArrayLike(array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0;
  const buf = createBuffer(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255;
  }
  return buf;
}
function fromArrayView(arrayView) {
  if (arrayView instanceof Uint8Array) {
    const copy2 = new Uint8Array(arrayView);
    return fromArrayBuffer(copy2.buffer, copy2.byteOffset, copy2.byteLength);
  }
  return fromArrayLike(arrayView);
}
function fromArrayBuffer(array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds');
  }
  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds');
  }
  let buf;
  if (byteOffset === void 0 && length === void 0) {
    buf = new Uint8Array(array);
  } else if (length === void 0) {
    buf = new Uint8Array(array, byteOffset);
  } else {
    buf = new Uint8Array(array, byteOffset, length);
  }
  Object.setPrototypeOf(buf, Buffer.prototype);
  return buf;
}
function fromObject(obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0;
    const buf = createBuffer(len);
    if (buf.length === 0) {
      return buf;
    }
    obj.copy(buf, 0, 0, len);
    return buf;
  }
  if (obj.length !== void 0) {
    if (typeof obj.length !== "number" || Number.isNaN(obj.length)) {
      return createBuffer(0);
    }
    return fromArrayLike(obj);
  }
  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data);
  }
}
function checked(length) {
  if (length >= K_MAX_LENGTH) {
    throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
  }
  return length | 0;
}
Buffer.isBuffer = function isBuffer(b) {
  return b != null && b._isBuffer === true && b !== Buffer.prototype;
};
Buffer.compare = function compare(a, b) {
  if (a instanceof Uint8Array) a = Buffer.from(a, a.offset, a.byteLength);
  if (b instanceof Uint8Array) b = Buffer.from(b, b.offset, b.byteLength);
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    );
  }
  if (a === b) return 0;
  let x = a.length;
  let y = b.length;
  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
};
Buffer.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case "hex":
    case "utf8":
    case "utf-8":
    case "ascii":
    case "latin1":
    case "binary":
    case "base64":
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return true;
    default:
      return false;
  }
};
Buffer.concat = function concat(list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }
  if (list.length === 0) {
    return Buffer.alloc(0);
  }
  let i;
  if (length === void 0) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }
  const buffer = Buffer.allocUnsafe(length);
  let pos = 0;
  for (i = 0; i < list.length; ++i) {
    let buf = list[i];
    if (buf instanceof Uint8Array) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) {
          buf = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
        }
        buf.copy(buffer, pos);
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        );
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    } else {
      buf.copy(buffer, pos);
    }
    pos += buf.length;
  }
  return buffer;
};
function byteLength(string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length;
  }
  if (ArrayBuffer.isView(string) || string instanceof ArrayBuffer) {
    return string.byteLength;
  }
  if (typeof string !== "string") {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
    );
  }
  const len = string.length;
  const mustMatch = arguments.length > 2 && arguments[2] === true;
  if (!mustMatch && len === 0) return 0;
  let loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len;
      case "utf8":
      case "utf-8":
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len * 2;
      case "hex":
        return len >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length;
        }
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;
function slowToString(encoding, start, end) {
  let loweredCase = false;
  if (start === void 0 || start < 0) {
    start = 0;
  }
  if (start > this.length) {
    return "";
  }
  if (end === void 0 || end > this.length) {
    end = this.length;
  }
  if (end <= 0) {
    return "";
  }
  end >>>= 0;
  start >>>= 0;
  if (end <= start) {
    return "";
  }
  if (!encoding) encoding = "utf8";
  while (true) {
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end);
      case "ascii":
        return asciiSlice(this, start, end);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end);
      case "base64":
        return base64Slice(this, start, end);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.prototype._isBuffer = true;
function swap(b, n, m2) {
  const i = b[n];
  b[n] = b[m2];
  b[m2] = i;
}
Buffer.prototype.swap16 = function swap16() {
  const len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 16-bits");
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this;
};
Buffer.prototype.swap32 = function swap32() {
  const len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 32-bits");
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this;
};
Buffer.prototype.swap64 = function swap64() {
  const len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 64-bits");
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this;
};
Buffer.prototype.toString = function toString() {
  const length = this.length;
  if (length === 0) return "";
  if (arguments.length === 0) return utf8Slice(this, 0, length);
  return slowToString.apply(this, arguments);
};
Buffer.prototype.toLocaleString = Buffer.prototype.toString;
Buffer.prototype.equals = function equals(b) {
  if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
  if (this === b) return true;
  return Buffer.compare(this, b) === 0;
};
Buffer.prototype.inspect = function inspect() {
  let str = "";
  const max = config.INSPECT_MAX_BYTES;
  str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
  if (this.length > max) str += " ... ";
  return "<Buffer " + str + ">";
};
Buffer.prototype[Symbol.for("nodejs.util.inspect.custom")] = Buffer.prototype.inspect;
Buffer.prototype.compare = function compare2(target, start, end, thisStart, thisEnd) {
  if (target instanceof Uint8Array) {
    target = Buffer.from(target, target.offset, target.byteLength);
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
    );
  }
  if (start === void 0) {
    start = 0;
  }
  if (end === void 0) {
    end = target ? target.length : 0;
  }
  if (thisStart === void 0) {
    thisStart = 0;
  }
  if (thisEnd === void 0) {
    thisEnd = this.length;
  }
  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError("out of range index");
  }
  if (thisStart >= thisEnd && start >= end) {
    return 0;
  }
  if (thisStart >= thisEnd) {
    return -1;
  }
  if (start >= end) {
    return 1;
  }
  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target) return 0;
  let x = thisEnd - thisStart;
  let y = end - start;
  const len = Math.min(x, y);
  const thisCopy = this.slice(thisStart, thisEnd);
  const targetCopy = target.slice(start, end);
  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }
  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
};
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0) return -1;
  if (typeof byteOffset === "string") {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 2147483647) {
    byteOffset = 2147483647;
  } else if (byteOffset < -2147483648) {
    byteOffset = -2147483648;
  }
  byteOffset = +byteOffset;
  if (Number.isNaN(byteOffset)) {
    byteOffset = dir ? 0 : buffer.length - 1;
  }
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1;
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1;
  }
  if (typeof val === "string") {
    val = Buffer.from(val, encoding);
  }
  if (Buffer.isBuffer(val)) {
    if (val.length === 0) {
      return -1;
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === "number") {
    val = val & 255;
    if (typeof Uint8Array.prototype.indexOf === "function") {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw new TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  let indexSize = 1;
  let arrLength = arr.length;
  let valLength = val.length;
  if (encoding !== void 0) {
    encoding = String(encoding).toLowerCase();
    if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val.length < 2) {
        return -1;
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }
  function read2(buf, i2) {
    if (indexSize === 1) {
      return buf[i2];
    } else {
      return buf.readUInt16BE(i2 * indexSize);
    }
  }
  let i;
  if (dir) {
    let foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read2(arr, i) === read2(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < valLength; j++) {
        if (read2(arr, i + j) !== read2(val, j)) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
  }
  return -1;
}
Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1;
};
Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
};
Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
};
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  const remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }
  const strLen = string.length;
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  let i;
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16);
    if (Number.isNaN(parsed)) return i;
    buf[offset + i] = parsed;
  }
  return i;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
Buffer.prototype.write = function write2(string, offset, length, encoding) {
  if (offset === void 0) {
    encoding = "utf8";
    length = this.length;
    offset = 0;
  } else if (length === void 0 && typeof offset === "string") {
    encoding = offset;
    length = this.length;
    offset = 0;
  } else if (isFinite(offset)) {
    offset = offset >>> 0;
    if (isFinite(length)) {
      length = length >>> 0;
      if (encoding === void 0) encoding = "utf8";
    } else {
      encoding = length;
      length = void 0;
    }
  } else {
    throw new Error(
      "Buffer.write(string, encoding, offset[, length]) is no longer supported"
    );
  }
  const remaining = this.length - offset;
  if (length === void 0 || length > remaining) length = remaining;
  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
    throw new RangeError("Attempt to write outside buffer bounds");
  }
  if (!encoding) encoding = "utf8";
  let loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "hex":
        return hexWrite(this, string, offset, length);
      case "utf8":
      case "utf-8":
        return utf8Write(this, string, offset, length);
      case "ascii":
      case "latin1":
      case "binary":
        return asciiWrite(this, string, offset, length);
      case "base64":
        return base64Write(this, string, offset, length);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return ucs2Write(this, string, offset, length);
      default:
        if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};
Buffer.prototype.toJSON = function toJSON() {
  return {
    type: "Buffer",
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf);
  } else {
    return fromByteArray(buf.slice(start, end));
  }
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  const res = [];
  let i = start;
  while (i < end) {
    const firstByte = buf[i];
    let codePoint = null;
    let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 65533;
      bytesPerSequence = 1;
    } else if (codePoint > 65535) {
      codePoint -= 65536;
      res.push(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
var MAX_ARGUMENTS_LENGTH = 4096;
function decodeCodePointsArray(codePoints) {
  const len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  let res = "";
  let i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res;
}
function asciiSlice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 127);
  }
  return ret;
}
function latin1Slice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}
function hexSlice(buf, start, end) {
  const len = buf.length;
  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;
  let out = "";
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]];
  }
  return out;
}
function utf16leSlice(buf, start, end) {
  const bytes = buf.slice(start, end);
  let res = "";
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res;
}
Buffer.prototype.slice = function slice(start, end) {
  const len = this.length;
  start = ~~start;
  end = end === void 0 ? len : ~~end;
  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }
  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }
  if (end < start) end = start;
  const newBuf = this.subarray(start, end);
  Object.setPrototypeOf(newBuf, Buffer.prototype);
  return newBuf;
};
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
  if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
}
Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) checkOffset(offset, byteLength2, this.length);
  let val = this[offset];
  let mul = 1;
  let i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val += this[offset + i] * mul;
  }
  return val;
};
Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) {
    checkOffset(offset, byteLength2, this.length);
  }
  let val = this[offset + --byteLength2];
  let mul = 1;
  while (byteLength2 > 0 && (mul *= 256)) {
    val += this[offset + --byteLength2] * mul;
  }
  return val;
};
Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset];
};
Buffer.prototype.readUint16LE = Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | this[offset + 1] << 8;
};
Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] << 8 | this[offset + 1];
};
Buffer.prototype.readUint32LE = Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
};
Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
};
Buffer.prototype.readBigUInt64LE = function readBigUInt64LE(offset) {
  offset = offset >>> 0;
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 7];
  if (first === void 0 || last === void 0) {
    boundsError(offset, this.length - 8);
  }
  const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
  const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
  return BigInt(lo) + (BigInt(hi) << BigInt(32));
};
Buffer.prototype.readBigUInt64BE = function readBigUInt64BE(offset) {
  offset = offset >>> 0;
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 7];
  if (first === void 0 || last === void 0) {
    boundsError(offset, this.length - 8);
  }
  const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
  const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
  return (BigInt(hi) << BigInt(32)) + BigInt(lo);
};
Buffer.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) checkOffset(offset, byteLength2, this.length);
  let val = this[offset];
  let mul = 1;
  let i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val += this[offset + i] * mul;
  }
  mul *= 128;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
  return val;
};
Buffer.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) checkOffset(offset, byteLength2, this.length);
  let i = byteLength2;
  let mul = 1;
  let val = this[offset + --i];
  while (i > 0 && (mul *= 256)) {
    val += this[offset + --i] * mul;
  }
  mul *= 128;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
  return val;
};
Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 128)) return this[offset];
  return (255 - this[offset] + 1) * -1;
};
Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  const val = this[offset] | this[offset + 1] << 8;
  return val & 32768 ? val | 4294901760 : val;
};
Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 2, this.length);
  const val = this[offset + 1] | this[offset] << 8;
  return val & 32768 ? val | 4294901760 : val;
};
Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
};
Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
};
Buffer.prototype.readBigInt64LE = function readBigInt64LE(offset) {
  offset = offset >>> 0;
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 7];
  if (first === void 0 || last === void 0) {
    boundsError(offset, this.length - 8);
  }
  const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
  return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
};
Buffer.prototype.readBigInt64BE = function readBigInt64BE(offset) {
  offset = offset >>> 0;
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 7];
  if (first === void 0 || last === void 0) {
    boundsError(offset, this.length - 8);
  }
  const val = (first << 24) + // Overflow
  this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
  return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
};
Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4);
};
Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4);
};
Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8);
};
Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  offset = offset >>> 0;
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8);
};
function checkInt(buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
}
Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  let mul = 1;
  let i = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset >>> 0;
  byteLength2 = byteLength2 >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  let i = byteLength2 - 1;
  let mul = 1;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
  this[offset] = value & 255;
  return offset + 1;
};
Buffer.prototype.writeUint16LE = Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
  this[offset] = value & 255;
  this[offset + 1] = value >>> 8;
  return offset + 2;
};
Buffer.prototype.writeUint16BE = Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
  this[offset] = value >>> 8;
  this[offset + 1] = value & 255;
  return offset + 2;
};
Buffer.prototype.writeUint32LE = Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
  this[offset + 3] = value >>> 24;
  this[offset + 2] = value >>> 16;
  this[offset + 1] = value >>> 8;
  this[offset] = value & 255;
  return offset + 4;
};
Buffer.prototype.writeUint32BE = Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
  this[offset] = value >>> 24;
  this[offset + 1] = value >>> 16;
  this[offset + 2] = value >>> 8;
  this[offset + 3] = value & 255;
  return offset + 4;
};
function wrtBigUInt64LE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  return offset;
}
function wrtBigUInt64BE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset + 7] = lo;
  lo = lo >> 8;
  buf[offset + 6] = lo;
  lo = lo >> 8;
  buf[offset + 5] = lo;
  lo = lo >> 8;
  buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset + 3] = hi;
  hi = hi >> 8;
  buf[offset + 2] = hi;
  hi = hi >> 8;
  buf[offset + 1] = hi;
  hi = hi >> 8;
  buf[offset] = hi;
  return offset + 8;
}
Buffer.prototype.writeBigUInt64LE = function writeBigUInt64LE(value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
};
Buffer.prototype.writeBigUInt64BE = function writeBigUInt64BE(value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
};
Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    const limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  let i = 0;
  let mul = 1;
  let sub = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    const limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  let i = byteLength2 - 1;
  let mul = 1;
  let sub = 0;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
  if (value < 0) value = 255 + value + 1;
  this[offset] = value & 255;
  return offset + 1;
};
Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
  this[offset] = value & 255;
  this[offset + 1] = value >>> 8;
  return offset + 2;
};
Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
  this[offset] = value >>> 8;
  this[offset + 1] = value & 255;
  return offset + 2;
};
Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
  this[offset] = value & 255;
  this[offset + 1] = value >>> 8;
  this[offset + 2] = value >>> 16;
  this[offset + 3] = value >>> 24;
  return offset + 4;
};
Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
  if (value < 0) value = 4294967295 + value + 1;
  this[offset] = value >>> 24;
  this[offset + 1] = value >>> 16;
  this[offset + 2] = value >>> 8;
  this[offset + 3] = value & 255;
  return offset + 4;
};
Buffer.prototype.writeBigInt64LE = function writeBigInt64LE(value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
};
Buffer.prototype.writeBigInt64BE = function writeBigInt64BE(value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
};
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
  if (offset < 0) throw new RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}
Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert);
};
Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert);
};
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  value = +value;
  offset = offset >>> 0;
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}
Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert);
};
Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert);
};
Buffer.prototype.copy = function copy(target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError("argument should be a Buffer");
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;
  if (end === start) return 0;
  if (target.length === 0 || this.length === 0) return 0;
  if (targetStart < 0) {
    throw new RangeError("targetStart out of bounds");
  }
  if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
  if (end < 0) throw new RangeError("sourceEnd out of bounds");
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }
  const len = end - start;
  if (this === target) {
    this.copyWithin(targetStart, start, end);
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    );
  }
  return len;
};
Buffer.prototype.fill = function fill(val, start, end, encoding) {
  if (typeof val === "string") {
    if (typeof start === "string") {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === "string") {
      encoding = end;
      end = this.length;
    }
    if (encoding !== void 0 && typeof encoding !== "string") {
      throw new TypeError("encoding must be a string");
    }
    if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
      throw new TypeError("Unknown encoding: " + encoding);
    }
    if (val.length === 1) {
      const code3 = val.charCodeAt(0);
      if (encoding === "utf8" && code3 < 128 || encoding === "latin1") {
        val = code3;
      }
    }
  } else if (typeof val === "number") {
    val = val & 255;
  } else if (typeof val === "boolean") {
    val = Number(val);
  }
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError("Out of range index");
  }
  if (end <= start) {
    return this;
  }
  start = start >>> 0;
  end = end === void 0 ? this.length : end >>> 0;
  if (!val) val = 0;
  let i;
  if (typeof val === "number") {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    const bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
    const len = bytes.length;
    if (len === 0) {
      throw new TypeError('The value "' + val + '" is invalid for argument "value"');
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }
  return this;
};
var errors = {};
function E(sym2, getMessage, Base) {
  errors[sym2] = class NodeError extends Base {
    constructor() {
      super();
      Object.defineProperty(this, "message", {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      });
      this.name = `${this.name} [${sym2}]`;
      this.stack;
      delete this.name;
    }
    get code() {
      return sym2;
    }
    set code(value) {
      Object.defineProperty(this, "code", {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    }
    toString() {
      return `${this.name} [${sym2}]: ${this.message}`;
    }
  };
}
E(
  "ERR_BUFFER_OUT_OF_BOUNDS",
  function(name) {
    if (name) {
      return `${name} is outside of buffer bounds`;
    }
    return "Attempt to access memory outside buffer bounds";
  },
  RangeError
);
E(
  "ERR_INVALID_ARG_TYPE",
  function(name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
  },
  TypeError
);
E(
  "ERR_OUT_OF_RANGE",
  function(str, range, input) {
    let msg = `The value of "${str}" is out of range.`;
    let received = input;
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input));
    } else if (typeof input === "bigint") {
      received = String(input);
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received);
      }
      received += "n";
    }
    msg += ` It must be ${range}. Received ${received}`;
    return msg;
  },
  RangeError
);
function addNumericalSeparator(val) {
  let res = "";
  let i = val.length;
  const start = val[0] === "-" ? 1 : 0;
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`;
  }
  return `${val.slice(0, i)}${res}`;
}
function checkBounds(buf, offset, byteLength2) {
  validateNumber(offset, "offset");
  if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
    boundsError(offset, buf.length - (byteLength2 + 1));
  }
}
function checkIntBI(value, min, max, buf, offset, byteLength2) {
  if (value > max || value < min) {
    const n = typeof min === "bigint" ? "n" : "";
    let range;
    if (byteLength2 > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
      } else {
        range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`;
    }
    throw new errors.ERR_OUT_OF_RANGE("value", range, value);
  }
  checkBounds(buf, offset, byteLength2);
}
function validateNumber(value, name) {
  if (typeof value !== "number") {
    throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
  }
}
function boundsError(value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type);
    throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
  }
  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
  }
  throw new errors.ERR_OUT_OF_RANGE(
    type || "offset",
    `>= ${type ? 1 : 0} and <= ${length}`,
    value
  );
}
var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
function base64clean(str) {
  str = str.split("=")[0];
  str = str.trim().replace(INVALID_BASE64_RE, "");
  if (str.length < 2) return "";
  while (str.length % 4 !== 0) {
    str = str + "=";
  }
  return str;
}
function utf8ToBytes(string, units) {
  units = units || Infinity;
  let codePoint;
  const length = string.length;
  let leadSurrogate = null;
  const bytes = [];
  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1) bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(239, 191, 189);
    }
    leadSurrogate = null;
    if (codePoint < 128) {
      if ((units -= 1) < 0) break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0) break;
      bytes.push(
        codePoint >> 6 | 192,
        codePoint & 63 | 128
      );
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0) break;
      bytes.push(
        codePoint >> 12 | 224,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128
      );
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0) break;
      bytes.push(
        codePoint >> 18 | 240,
        codePoint >> 12 & 63 | 128,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128
      );
    } else {
      throw new Error("Invalid code point");
    }
  }
  return bytes;
}
function asciiToBytes(str) {
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    byteArray.push(str.charCodeAt(i) & 255);
  }
  return byteArray;
}
function utf16leToBytes(str, units) {
  let c, hi, lo;
  const byteArray = [];
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  let i;
  for (i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break;
    dst[i + offset] = src[i];
  }
  return i;
}
var hexSliceLookupTable = function() {
  const alphabet = "0123456789abcdef";
  const table = new Array(256);
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16;
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j];
    }
  }
  return table;
}();

// agent/src/lib/types.ts
var FilterType;
(function(FilterType2) {
  FilterType2[FilterType2["Incoming"] = 1] = "Incoming";
  FilterType2[FilterType2["Outgoing"] = 2] = "Outgoing";
  FilterType2[FilterType2["All"] = 3] = "All";
})(FilterType || (FilterType = {}));

// node_modules/frida-objc-bridge/lib/api.js
var cachedApi = null;
var defaultInvocationOptions = {
  exceptions: "propagate"
};
function getApi() {
  if (cachedApi !== null) {
    return cachedApi;
  }
  const temporaryApi = {};
  const pending = [
    {
      module: "libsystem_malloc.dylib",
      functions: {
        "free": ["void", ["pointer"]]
      }
    },
    {
      module: "libobjc.A.dylib",
      functions: {
        "objc_msgSend": function(address) {
          this.objc_msgSend = address;
        },
        "objc_msgSend_stret": function(address) {
          this.objc_msgSend_stret = address;
        },
        "objc_msgSend_fpret": function(address) {
          this.objc_msgSend_fpret = address;
        },
        "objc_msgSendSuper": function(address) {
          this.objc_msgSendSuper = address;
        },
        "objc_msgSendSuper_stret": function(address) {
          this.objc_msgSendSuper_stret = address;
        },
        "objc_msgSendSuper_fpret": function(address) {
          this.objc_msgSendSuper_fpret = address;
        },
        "objc_getClassList": ["int", ["pointer", "int"]],
        "objc_lookUpClass": ["pointer", ["pointer"]],
        "objc_allocateClassPair": ["pointer", ["pointer", "pointer", "pointer"]],
        "objc_disposeClassPair": ["void", ["pointer"]],
        "objc_registerClassPair": ["void", ["pointer"]],
        "class_isMetaClass": ["bool", ["pointer"]],
        "class_getName": ["pointer", ["pointer"]],
        "class_getImageName": ["pointer", ["pointer"]],
        "class_copyProtocolList": ["pointer", ["pointer", "pointer"]],
        "class_copyMethodList": ["pointer", ["pointer", "pointer"]],
        "class_getClassMethod": ["pointer", ["pointer", "pointer"]],
        "class_getInstanceMethod": ["pointer", ["pointer", "pointer"]],
        "class_getSuperclass": ["pointer", ["pointer"]],
        "class_addProtocol": ["bool", ["pointer", "pointer"]],
        "class_addMethod": ["bool", ["pointer", "pointer", "pointer", "pointer"]],
        "class_copyIvarList": ["pointer", ["pointer", "pointer"]],
        "objc_getProtocol": ["pointer", ["pointer"]],
        "objc_copyProtocolList": ["pointer", ["pointer"]],
        "objc_allocateProtocol": ["pointer", ["pointer"]],
        "objc_registerProtocol": ["void", ["pointer"]],
        "protocol_getName": ["pointer", ["pointer"]],
        "protocol_copyMethodDescriptionList": ["pointer", ["pointer", "bool", "bool", "pointer"]],
        "protocol_copyPropertyList": ["pointer", ["pointer", "pointer"]],
        "protocol_copyProtocolList": ["pointer", ["pointer", "pointer"]],
        "protocol_addProtocol": ["void", ["pointer", "pointer"]],
        "protocol_addMethodDescription": ["void", ["pointer", "pointer", "pointer", "bool", "bool"]],
        "ivar_getName": ["pointer", ["pointer"]],
        "ivar_getTypeEncoding": ["pointer", ["pointer"]],
        "ivar_getOffset": ["pointer", ["pointer"]],
        "object_isClass": ["bool", ["pointer"]],
        "object_getClass": ["pointer", ["pointer"]],
        "object_getClassName": ["pointer", ["pointer"]],
        "method_getName": ["pointer", ["pointer"]],
        "method_getTypeEncoding": ["pointer", ["pointer"]],
        "method_getImplementation": ["pointer", ["pointer"]],
        "method_setImplementation": ["pointer", ["pointer", "pointer"]],
        "property_getName": ["pointer", ["pointer"]],
        "property_copyAttributeList": ["pointer", ["pointer", "pointer"]],
        "sel_getName": ["pointer", ["pointer"]],
        "sel_registerName": ["pointer", ["pointer"]],
        "class_getInstanceSize": ["pointer", ["pointer"]]
      },
      optionals: {
        "objc_msgSend_stret": "ABI",
        "objc_msgSend_fpret": "ABI",
        "objc_msgSendSuper_stret": "ABI",
        "objc_msgSendSuper_fpret": "ABI",
        "object_isClass": "iOS8"
      }
    },
    {
      module: "libdispatch.dylib",
      functions: {
        "dispatch_async_f": ["void", ["pointer", "pointer", "pointer"]]
      },
      variables: {
        "_dispatch_main_q": function(address) {
          this._dispatch_main_q = address;
        }
      }
    }
  ];
  let remaining = 0;
  pending.forEach(function(api2) {
    const isObjCApi = api2.module === "libobjc.A.dylib";
    const functions = api2.functions || {};
    const variables = api2.variables || {};
    const optionals = api2.optionals || {};
    remaining += Object.keys(functions).length + Object.keys(variables).length;
    const exportByName = (Process.findModuleByName(api2.module)?.enumerateExports() ?? []).reduce(function(result, exp) {
      result[exp.name] = exp;
      return result;
    }, {});
    Object.keys(functions).forEach(function(name) {
      const exp = exportByName[name];
      if (exp !== void 0 && exp.type === "function") {
        const signature2 = functions[name];
        if (typeof signature2 === "function") {
          signature2.call(temporaryApi, exp.address);
          if (isObjCApi)
            signature2.call(temporaryApi, exp.address);
        } else {
          temporaryApi[name] = new NativeFunction(exp.address, signature2[0], signature2[1], defaultInvocationOptions);
          if (isObjCApi)
            temporaryApi[name] = temporaryApi[name];
        }
        remaining--;
      } else {
        const optional = optionals[name];
        if (optional)
          remaining--;
      }
    });
    Object.keys(variables).forEach(function(name) {
      const exp = exportByName[name];
      if (exp !== void 0 && exp.type === "variable") {
        const handler = variables[name];
        handler.call(temporaryApi, exp.address);
        remaining--;
      }
    });
  });
  if (remaining === 0) {
    if (!temporaryApi.objc_msgSend_stret)
      temporaryApi.objc_msgSend_stret = temporaryApi.objc_msgSend;
    if (!temporaryApi.objc_msgSend_fpret)
      temporaryApi.objc_msgSend_fpret = temporaryApi.objc_msgSend;
    if (!temporaryApi.objc_msgSendSuper_stret)
      temporaryApi.objc_msgSendSuper_stret = temporaryApi.objc_msgSendSuper;
    if (!temporaryApi.objc_msgSendSuper_fpret)
      temporaryApi.objc_msgSendSuper_fpret = temporaryApi.objc_msgSendSuper;
    cachedApi = temporaryApi;
  }
  return cachedApi;
}

// node_modules/frida-objc-bridge/lib/fastpaths.js
var code2 = `#include <glib.h>
#include <ptrauth.h>

#define KERN_SUCCESS 0
#define MALLOC_PTR_IN_USE_RANGE_TYPE 1
#if defined (HAVE_I386) && GLIB_SIZEOF_VOID_P == 8
# define OBJC_ISA_MASK 0x7ffffffffff8ULL
#elif defined (HAVE_ARM64)
# define OBJC_ISA_MASK 0xffffffff8ULL
#endif

typedef struct _ChooseContext ChooseContext;

typedef struct _malloc_zone_t malloc_zone_t;
typedef struct _malloc_introspection_t malloc_introspection_t;
typedef struct _vm_range_t vm_range_t;

typedef gpointer Class;
typedef int kern_return_t;
typedef guint mach_port_t;
typedef mach_port_t task_t;
typedef guintptr vm_offset_t;
typedef guintptr vm_size_t;
typedef vm_offset_t vm_address_t;

struct _ChooseContext
{
  GHashTable * classes;
  GArray * matches;
};

struct _malloc_zone_t
{
  void * reserved1;
  void * reserved2;
  size_t (* size) (struct _malloc_zone_t * zone, const void * ptr);
  void * (* malloc) (struct _malloc_zone_t * zone, size_t size);
  void * (* calloc) (struct _malloc_zone_t * zone, size_t num_items, size_t size);
  void * (* valloc) (struct _malloc_zone_t * zone, size_t size);
  void (* free) (struct _malloc_zone_t * zone, void * ptr);
  void * (* realloc) (struct _malloc_zone_t * zone, void * ptr, size_t size);
  void (* destroy) (struct _malloc_zone_t * zone);
  const char * zone_name;

  unsigned (* batch_malloc) (struct _malloc_zone_t * zone, size_t size, void ** results, unsigned num_requested);
  void (* batch_free) (struct _malloc_zone_t * zone, void ** to_be_freed, unsigned num_to_be_freed);

  malloc_introspection_t * introspect;
};

typedef kern_return_t (* memory_reader_t) (task_t remote_task, vm_address_t remote_address, vm_size_t size, void ** local_memory);
typedef void (* vm_range_recorder_t) (task_t task, void * user_data, unsigned type, vm_range_t * ranges, unsigned count);
typedef kern_return_t (* enumerator_func) (task_t task, void * user_data, unsigned type_mask, vm_address_t zone_address, memory_reader_t reader,
      vm_range_recorder_t recorder);

struct _malloc_introspection_t
{
  enumerator_func enumerator;
};

struct _vm_range_t
{
  vm_address_t address;
  vm_size_t size;
};

extern int objc_getClassList (Class * buffer, int buffer_count);
extern Class class_getSuperclass (Class cls);
extern size_t class_getInstanceSize (Class cls);
extern kern_return_t malloc_get_all_zones (task_t task, memory_reader_t reader, vm_address_t ** addresses, unsigned * count);

static void collect_subclasses (Class klass, GHashTable * result);
static void collect_matches_in_ranges (task_t task, void * user_data, unsigned type, vm_range_t * ranges, unsigned count);
static kern_return_t read_local_memory (task_t remote_task, vm_address_t remote_address, vm_size_t size, void ** local_memory);

extern mach_port_t selfTask;

gpointer *
choose (Class * klass,
        gboolean consider_subclasses,
        guint * count)
{
  ChooseContext ctx;
  GHashTable * classes;
  vm_address_t * malloc_zone_addresses;
  unsigned malloc_zone_count, i;

  classes = g_hash_table_new_full (NULL, NULL, NULL, NULL);
  ctx.classes = classes;
  ctx.matches = g_array_new (FALSE, FALSE, sizeof (gpointer));
  if (consider_subclasses)
    collect_subclasses (klass, classes);
  else
    g_hash_table_insert (classes, klass, GSIZE_TO_POINTER (class_getInstanceSize (klass)));

  malloc_zone_count = 0;
  malloc_get_all_zones (selfTask, read_local_memory, &malloc_zone_addresses, &malloc_zone_count);

  for (i = 0; i != malloc_zone_count; i++)
  {
    vm_address_t zone_address = malloc_zone_addresses[i];
    malloc_zone_t * zone = (malloc_zone_t *) zone_address;
    enumerator_func enumerator;

    if (zone != NULL && zone->introspect != NULL &&
        (enumerator = (ptrauth_strip (zone->introspect, ptrauth_key_asda))->enumerator) != NULL)
    {
      enumerator = ptrauth_sign_unauthenticated (
          ptrauth_strip (enumerator, ptrauth_key_asia),
          ptrauth_key_asia, 0);

      enumerator (selfTask, &ctx, MALLOC_PTR_IN_USE_RANGE_TYPE, zone_address, read_local_memory,
          collect_matches_in_ranges);
    }
  }

  g_hash_table_unref (classes);

  *count = ctx.matches->len;

  return (gpointer *) g_array_free (ctx.matches, FALSE);
}

void
destroy (gpointer mem)
{
  g_free (mem);
}

static void
collect_subclasses (Class klass,
                    GHashTable * result)
{
  Class * classes;
  int count, i;

  count = objc_getClassList (NULL, 0);
  classes = g_malloc (count * sizeof (gpointer));
  count = objc_getClassList (classes, count);

  for (i = 0; i != count; i++)
  {
    Class candidate = classes[i];
    Class c;

    c = candidate;
    do
    {
      if (c == klass)
      {
        g_hash_table_insert (result, candidate, GSIZE_TO_POINTER (class_getInstanceSize (candidate)));
        break;
      }

      c = class_getSuperclass (c);
    }
    while (c != NULL);
  }

  g_free (classes);
}

static void
collect_matches_in_ranges (task_t task,
                           void * user_data,
                           unsigned type,
                           vm_range_t * ranges,
                           unsigned count)
{
  ChooseContext * ctx = user_data;
  GHashTable * classes = ctx->classes;
  unsigned i;

  for (i = 0; i != count; i++)
  {
    const vm_range_t * range = &ranges[i];
    gconstpointer candidate = GSIZE_TO_POINTER (range->address);
    gconstpointer isa;
    guint instance_size;

    isa = *(gconstpointer *) candidate;
#ifdef OBJC_ISA_MASK
    isa = GSIZE_TO_POINTER (GPOINTER_TO_SIZE (isa) & OBJC_ISA_MASK);
#endif

    instance_size = GPOINTER_TO_UINT (g_hash_table_lookup (classes, isa));
    if (instance_size != 0 && range->size >= instance_size)
    {
      g_array_append_val (ctx->matches, candidate);
    }
  }
}

static kern_return_t
read_local_memory (task_t remote_task,
                   vm_address_t remote_address,
                   vm_size_t size,
                   void ** local_memory)
{
  *local_memory = (void *) remote_address;

  return KERN_SUCCESS;
}
`;
var { pointerSize: pointerSize2 } = Process;
var cachedModule = null;
function get() {
  if (cachedModule === null)
    cachedModule = compileModule();
  return cachedModule;
}
function compileModule() {
  const {
    objc_getClassList,
    class_getSuperclass,
    class_getInstanceSize
  } = getApi();
  const selfTask = Memory.alloc(4);
  selfTask.writeU32(Module.getGlobalExportByName("mach_task_self_").readU32());
  const cm = new CModule(code2, {
    objc_getClassList,
    class_getSuperclass,
    class_getInstanceSize,
    malloc_get_all_zones: Process.getModuleByName("/usr/lib/system/libsystem_malloc.dylib").getExportByName("malloc_get_all_zones"),
    selfTask
  });
  const _choose = new NativeFunction(cm.choose, "pointer", ["pointer", "bool", "pointer"]);
  const _destroy = new NativeFunction(cm.destroy, "void", ["pointer"]);
  return {
    handle: cm,
    choose(klass, considerSubclasses) {
      const result = [];
      const countPtr = Memory.alloc(4);
      const matches = _choose(klass, considerSubclasses ? 1 : 0, countPtr);
      try {
        const count = countPtr.readU32();
        for (let i = 0; i !== count; i++)
          result.push(matches.add(i * pointerSize2).readPointer());
      } finally {
        _destroy(matches);
      }
      return result;
    }
  };
}

// node_modules/frida-objc-bridge/index.js
function Runtime() {
  const pointerSize = Process.pointerSize;
  let api = null;
  let apiError = null;
  const realizedClasses = /* @__PURE__ */ new Set();
  const classRegistry = new ClassRegistry();
  const protocolRegistry = new ProtocolRegistry();
  const replacedMethods = /* @__PURE__ */ new Map();
  const scheduledWork = /* @__PURE__ */ new Map();
  let nextId = 1;
  let workCallback = null;
  let NSAutoreleasePool = null;
  const bindings = /* @__PURE__ */ new Map();
  let readObjectIsa = null;
  const msgSendBySignatureId = /* @__PURE__ */ new Map();
  const msgSendSuperBySignatureId = /* @__PURE__ */ new Map();
  let cachedNSString = null;
  let cachedNSStringCtor = null;
  let cachedNSNumber = null;
  let cachedNSNumberCtor = null;
  let singularTypeById = null;
  let modifiers = null;
  try {
    tryInitialize();
  } catch (e) {
  }
  function tryInitialize() {
    if (api !== null)
      return true;
    if (apiError !== null)
      throw apiError;
    try {
      api = getApi();
    } catch (e) {
      apiError = e;
      throw e;
    }
    return api !== null;
  }
  function dispose() {
    for (const [rawMethodHandle, impls] of replacedMethods.entries()) {
      const methodHandle = ptr(rawMethodHandle);
      const [oldImp, newImp] = impls;
      if (api.method_getImplementation(methodHandle).equals(newImp))
        api.method_setImplementation(methodHandle, oldImp);
    }
    replacedMethods.clear();
  }
  Script.bindWeak(this, dispose);
  Object.defineProperty(this, "available", {
    enumerable: true,
    get() {
      return tryInitialize();
    }
  });
  Object.defineProperty(this, "api", {
    enumerable: true,
    get() {
      return getApi();
    }
  });
  Object.defineProperty(this, "classes", {
    enumerable: true,
    value: classRegistry
  });
  Object.defineProperty(this, "protocols", {
    enumerable: true,
    value: protocolRegistry
  });
  Object.defineProperty(this, "Object", {
    enumerable: true,
    value: ObjCObject
  });
  Object.defineProperty(this, "Protocol", {
    enumerable: true,
    value: ObjCProtocol
  });
  Object.defineProperty(this, "Block", {
    enumerable: true,
    value: Block
  });
  Object.defineProperty(this, "mainQueue", {
    enumerable: true,
    get() {
      return api?._dispatch_main_q ?? null;
    }
  });
  Object.defineProperty(this, "registerProxy", {
    enumerable: true,
    value: registerProxy
  });
  Object.defineProperty(this, "registerClass", {
    enumerable: true,
    value: registerClass
  });
  Object.defineProperty(this, "registerProtocol", {
    enumerable: true,
    value: registerProtocol
  });
  Object.defineProperty(this, "bind", {
    enumerable: true,
    value: bind
  });
  Object.defineProperty(this, "unbind", {
    enumerable: true,
    value: unbind
  });
  Object.defineProperty(this, "getBoundData", {
    enumerable: true,
    value: getBoundData
  });
  Object.defineProperty(this, "enumerateLoadedClasses", {
    enumerable: true,
    value: enumerateLoadedClasses
  });
  Object.defineProperty(this, "enumerateLoadedClassesSync", {
    enumerable: true,
    value: enumerateLoadedClassesSync
  });
  Object.defineProperty(this, "choose", {
    enumerable: true,
    value: choose
  });
  Object.defineProperty(this, "chooseSync", {
    enumerable: true,
    value(specifier) {
      const instances = [];
      choose(specifier, {
        onMatch(i) {
          instances.push(i);
        },
        onComplete() {
        }
      });
      return instances;
    }
  });
  this.schedule = function(queue, work) {
    const id = ptr(nextId++);
    scheduledWork.set(id.toString(), work);
    if (workCallback === null) {
      workCallback = new NativeCallback(performScheduledWorkItem, "void", ["pointer"]);
    }
    Script.pin();
    api.dispatch_async_f(queue, id, workCallback);
  };
  function performScheduledWorkItem(rawId) {
    const id = rawId.toString();
    const work = scheduledWork.get(id);
    scheduledWork.delete(id);
    if (NSAutoreleasePool === null)
      NSAutoreleasePool = classRegistry.NSAutoreleasePool;
    const pool = NSAutoreleasePool.alloc().init();
    let pendingException = null;
    try {
      work();
    } catch (e) {
      pendingException = e;
    }
    pool.release();
    setImmediate(performScheduledWorkCleanup, pendingException);
  }
  function performScheduledWorkCleanup(pendingException) {
    Script.unpin();
    if (pendingException !== null) {
      throw pendingException;
    }
  }
  this.implement = function(method2, fn) {
    return new NativeCallback(fn, method2.returnType, method2.argumentTypes);
  };
  this.selector = selector;
  this.selectorAsString = selectorAsString;
  function selector(name) {
    return api.sel_registerName(Memory.allocUtf8String(name));
  }
  function selectorAsString(sel2) {
    return api.sel_getName(sel2).readUtf8String();
  }
  const registryBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf"
  ]);
  function ClassRegistry() {
    const cachedClasses = {};
    let numCachedClasses = 0;
    const registry = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const klass = findClass(property);
            return klass !== null ? klass : void 0;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (api === null)
          return [];
        let numClasses = api.objc_getClassList(NULL, 0);
        if (numClasses !== numCachedClasses) {
          const classHandles = Memory.alloc(numClasses * pointerSize);
          numClasses = api.objc_getClassList(classHandles, numClasses);
          for (let i = 0; i !== numClasses; i++) {
            const handle2 = classHandles.add(i * pointerSize).readPointer();
            const name = api.class_getName(handle2).readUtf8String();
            cachedClasses[name] = handle2;
          }
          numCachedClasses = numClasses;
        }
        return Object.keys(cachedClasses);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    function hasProperty(name) {
      if (registryBuiltins.has(name))
        return true;
      return findClass(name) !== null;
    }
    function getClass(name) {
      const cls = findClass(name);
      if (cls === null)
        throw new Error("Unable to find class '" + name + "'");
      return cls;
    }
    function findClass(name) {
      let handle2 = cachedClasses[name];
      if (handle2 === void 0) {
        handle2 = api.objc_lookUpClass(Memory.allocUtf8String(name));
        if (handle2.isNull())
          return null;
        cachedClasses[name] = handle2;
        numCachedClasses++;
      }
      return new ObjCObject(handle2, void 0, true);
    }
    function toJSON2() {
      return Object.keys(registry).reduce(function(r, name) {
        r[name] = getClass(name).toJSON();
        return r;
      }, {});
    }
    function toString2() {
      return "ClassRegistry";
    }
    function valueOf() {
      return "ClassRegistry";
    }
    return registry;
  }
  function ProtocolRegistry() {
    let cachedProtocols = {};
    let numCachedProtocols = 0;
    const registry = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const proto = findProtocol(property);
            return proto !== null ? proto : void 0;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (api === null)
          return [];
        const numProtocolsBuf = Memory.alloc(pointerSize);
        const protocolHandles = api.objc_copyProtocolList(numProtocolsBuf);
        try {
          const numProtocols = numProtocolsBuf.readUInt();
          if (numProtocols !== numCachedProtocols) {
            cachedProtocols = {};
            for (let i = 0; i !== numProtocols; i++) {
              const handle2 = protocolHandles.add(i * pointerSize).readPointer();
              const name = api.protocol_getName(handle2).readUtf8String();
              cachedProtocols[name] = handle2;
            }
            numCachedProtocols = numProtocols;
          }
        } finally {
          api.free(protocolHandles);
        }
        return Object.keys(cachedProtocols);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    function hasProperty(name) {
      if (registryBuiltins.has(name))
        return true;
      return findProtocol(name) !== null;
    }
    function findProtocol(name) {
      let handle2 = cachedProtocols[name];
      if (handle2 === void 0) {
        handle2 = api.objc_getProtocol(Memory.allocUtf8String(name));
        if (handle2.isNull())
          return null;
        cachedProtocols[name] = handle2;
        numCachedProtocols++;
      }
      return new ObjCProtocol(handle2);
    }
    function toJSON2() {
      return Object.keys(registry).reduce(function(r, name) {
        r[name] = { handle: cachedProtocols[name] };
        return r;
      }, {});
    }
    function toString2() {
      return "ProtocolRegistry";
    }
    function valueOf() {
      return "ProtocolRegistry";
    }
    return registry;
  }
  const objCObjectBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "handle",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf",
    "equals",
    "$kind",
    "$super",
    "$superClass",
    "$class",
    "$className",
    "$moduleName",
    "$protocols",
    "$methods",
    "$ownMethods",
    "$ivars"
  ]);
  function ObjCObject(handle2, protocol, cachedIsClass, superSpecifier2) {
    let cachedClassHandle = null;
    let cachedKind = null;
    let cachedSuper = null;
    let cachedSuperClass = null;
    let cachedClass = null;
    let cachedClassName = null;
    let cachedModuleName = null;
    let cachedProtocols = null;
    let cachedMethodNames = null;
    let cachedProtocolMethods = null;
    let respondsToSelector = null;
    const cachedMethods = {};
    let cachedNativeMethodNames = null;
    let cachedOwnMethodNames = null;
    let cachedIvars = null;
    handle2 = getHandle(handle2);
    if (cachedIsClass === void 0) {
      const klass = api.object_getClass(handle2);
      const key = klass.toString();
      if (!realizedClasses.has(key)) {
        api.objc_lookUpClass(api.class_getName(klass));
        realizedClasses.add(key);
      }
    }
    const self = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "handle":
            return handle2;
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
          case "valueOf":
            const descriptionImpl = receiver.description;
            if (descriptionImpl !== void 0) {
              const description = descriptionImpl.call(receiver);
              if (description !== null)
                return description.UTF8String.bind(description);
            }
            return function() {
              return receiver.$className;
            };
          case "equals":
            return equals2;
          case "$kind":
            if (cachedKind === null) {
              if (isClass())
                cachedKind = api.class_isMetaClass(handle2) ? "meta-class" : "class";
              else
                cachedKind = "instance";
            }
            return cachedKind;
          case "$super":
            if (cachedSuper === null) {
              const superHandle = api.class_getSuperclass(classHandle());
              if (!superHandle.isNull()) {
                const specifier = Memory.alloc(2 * pointerSize);
                specifier.writePointer(handle2);
                specifier.add(pointerSize).writePointer(superHandle);
                cachedSuper = [new ObjCObject(handle2, void 0, cachedIsClass, specifier)];
              } else {
                cachedSuper = [null];
              }
            }
            return cachedSuper[0];
          case "$superClass":
            if (cachedSuperClass === null) {
              const superClassHandle = api.class_getSuperclass(classHandle());
              if (!superClassHandle.isNull()) {
                cachedSuperClass = [new ObjCObject(superClassHandle)];
              } else {
                cachedSuperClass = [null];
              }
            }
            return cachedSuperClass[0];
          case "$class":
            if (cachedClass === null)
              cachedClass = new ObjCObject(api.object_getClass(handle2), void 0, true);
            return cachedClass;
          case "$className":
            if (cachedClassName === null) {
              if (superSpecifier2)
                cachedClassName = api.class_getName(superSpecifier2.add(pointerSize).readPointer()).readUtf8String();
              else if (isClass())
                cachedClassName = api.class_getName(handle2).readUtf8String();
              else
                cachedClassName = api.object_getClassName(handle2).readUtf8String();
            }
            return cachedClassName;
          case "$moduleName":
            if (cachedModuleName === null) {
              cachedModuleName = api.class_getImageName(classHandle()).readUtf8String();
            }
            return cachedModuleName;
          case "$protocols":
            if (cachedProtocols === null) {
              cachedProtocols = {};
              const numProtocolsBuf = Memory.alloc(pointerSize);
              const protocolHandles = api.class_copyProtocolList(classHandle(), numProtocolsBuf);
              if (!protocolHandles.isNull()) {
                try {
                  const numProtocols = numProtocolsBuf.readUInt();
                  for (let i = 0; i !== numProtocols; i++) {
                    const protocolHandle = protocolHandles.add(i * pointerSize).readPointer();
                    const p = new ObjCProtocol(protocolHandle);
                    cachedProtocols[p.name] = p;
                  }
                } finally {
                  api.free(protocolHandles);
                }
              }
            }
            return cachedProtocols;
          case "$methods":
            if (cachedNativeMethodNames === null) {
              const klass = superSpecifier2 ? superSpecifier2.add(pointerSize).readPointer() : classHandle();
              const meta = api.object_getClass(klass);
              const names = /* @__PURE__ */ new Set();
              let cur = meta;
              do {
                for (let methodName of collectMethodNames(cur, "+ "))
                  names.add(methodName);
                cur = api.class_getSuperclass(cur);
              } while (!cur.isNull());
              cur = klass;
              do {
                for (let methodName of collectMethodNames(cur, "- "))
                  names.add(methodName);
                cur = api.class_getSuperclass(cur);
              } while (!cur.isNull());
              cachedNativeMethodNames = Array.from(names);
            }
            return cachedNativeMethodNames;
          case "$ownMethods":
            if (cachedOwnMethodNames === null) {
              const klass = superSpecifier2 ? superSpecifier2.add(pointerSize).readPointer() : classHandle();
              const meta = api.object_getClass(klass);
              const classMethods = collectMethodNames(meta, "+ ");
              const instanceMethods = collectMethodNames(klass, "- ");
              cachedOwnMethodNames = classMethods.concat(instanceMethods);
            }
            return cachedOwnMethodNames;
          case "$ivars":
            if (cachedIvars === null) {
              if (isClass())
                cachedIvars = {};
              else
                cachedIvars = new ObjCIvars(self, classHandle());
            }
            return cachedIvars;
          default:
            if (typeof property === "symbol") {
              return target[property];
            }
            if (protocol) {
              const details = findProtocolMethod(property);
              if (details === null || !details.implemented)
                return void 0;
            }
            const wrapper = findMethodWrapper(property);
            if (wrapper === null)
              return void 0;
            return wrapper;
        }
      },
      set(target, property, value, receiver) {
        return false;
      },
      ownKeys(target) {
        if (cachedMethodNames === null) {
          if (!protocol) {
            const jsNames = {};
            const nativeNames = {};
            let cur = api.object_getClass(handle2);
            do {
              const numMethodsBuf = Memory.alloc(pointerSize);
              const methodHandles = api.class_copyMethodList(cur, numMethodsBuf);
              const fullNamePrefix = isClass() ? "+ " : "- ";
              try {
                const numMethods = numMethodsBuf.readUInt();
                for (let i = 0; i !== numMethods; i++) {
                  const methodHandle = methodHandles.add(i * pointerSize).readPointer();
                  const sel2 = api.method_getName(methodHandle);
                  const nativeName = api.sel_getName(sel2).readUtf8String();
                  if (nativeNames[nativeName] !== void 0)
                    continue;
                  nativeNames[nativeName] = nativeName;
                  const jsName = jsMethodName(nativeName);
                  let serial = 2;
                  let name = jsName;
                  while (jsNames[name] !== void 0) {
                    serial++;
                    name = jsName + serial;
                  }
                  jsNames[name] = true;
                  const fullName = fullNamePrefix + nativeName;
                  if (cachedMethods[fullName] === void 0) {
                    const details = {
                      sel: sel2,
                      handle: methodHandle,
                      wrapper: null
                    };
                    cachedMethods[fullName] = details;
                    cachedMethods[name] = details;
                  }
                }
              } finally {
                api.free(methodHandles);
              }
              cur = api.class_getSuperclass(cur);
            } while (!cur.isNull());
            cachedMethodNames = Object.keys(jsNames);
          } else {
            const methodNames = [];
            const protocolMethods = allProtocolMethods();
            Object.keys(protocolMethods).forEach(function(methodName) {
              if (methodName[0] !== "+" && methodName[0] !== "-") {
                const details = protocolMethods[methodName];
                if (details.implemented) {
                  methodNames.push(methodName);
                }
              }
            });
            cachedMethodNames = methodNames;
          }
        }
        return ["handle"].concat(cachedMethodNames);
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: false,
          configurable: true,
          enumerable: true
        };
      }
    });
    if (protocol) {
      respondsToSelector = !isClass() ? findMethodWrapper("- respondsToSelector:") : null;
    }
    return self;
    function hasProperty(name) {
      if (objCObjectBuiltins.has(name))
        return true;
      if (protocol) {
        const details = findProtocolMethod(name);
        return !!(details !== null && details.implemented);
      }
      return findMethod(name) !== null;
    }
    function classHandle() {
      if (cachedClassHandle === null)
        cachedClassHandle = isClass() ? handle2 : api.object_getClass(handle2);
      return cachedClassHandle;
    }
    function isClass() {
      if (cachedIsClass === void 0) {
        if (api.object_isClass)
          cachedIsClass = !!api.object_isClass(handle2);
        else
          cachedIsClass = !!api.class_isMetaClass(api.object_getClass(handle2));
      }
      return cachedIsClass;
    }
    function findMethod(rawName) {
      let method2 = cachedMethods[rawName];
      if (method2 !== void 0)
        return method2;
      const tokens = parseMethodName(rawName);
      const fullName = tokens[2];
      method2 = cachedMethods[fullName];
      if (method2 !== void 0) {
        cachedMethods[rawName] = method2;
        return method2;
      }
      const kind = tokens[0];
      const name = tokens[1];
      const sel2 = selector(name);
      const defaultKind = isClass() ? "+" : "-";
      if (protocol) {
        const details = findProtocolMethod(fullName);
        if (details !== null) {
          method2 = {
            sel: sel2,
            types: details.types,
            wrapper: null,
            kind
          };
        }
      }
      if (method2 === void 0) {
        const methodHandle = kind === "+" ? api.class_getClassMethod(classHandle(), sel2) : api.class_getInstanceMethod(classHandle(), sel2);
        if (!methodHandle.isNull()) {
          method2 = {
            sel: sel2,
            handle: methodHandle,
            wrapper: null,
            kind
          };
        } else {
          if (isClass() || kind !== "-" || name === "forwardingTargetForSelector:" || name === "methodSignatureForSelector:") {
            return null;
          }
          let target = self;
          if ("- forwardingTargetForSelector:" in self) {
            const forwardingTarget = self.forwardingTargetForSelector_(sel2);
            if (forwardingTarget !== null && forwardingTarget.$kind === "instance") {
              target = forwardingTarget;
            } else {
              return null;
            }
          } else {
            return null;
          }
          const methodHandle2 = api.class_getInstanceMethod(api.object_getClass(target.handle), sel2);
          if (methodHandle2.isNull()) {
            return null;
          }
          let types2 = api.method_getTypeEncoding(methodHandle2).readUtf8String();
          if (types2 === null || types2 === "") {
            types2 = stealTypesFromProtocols(target, fullName);
            if (types2 === null)
              types2 = stealTypesFromProtocols(self, fullName);
            if (types2 === null)
              return null;
          }
          method2 = {
            sel: sel2,
            types: types2,
            wrapper: null,
            kind
          };
        }
      }
      cachedMethods[fullName] = method2;
      cachedMethods[rawName] = method2;
      if (kind === defaultKind)
        cachedMethods[jsMethodName(name)] = method2;
      return method2;
    }
    function stealTypesFromProtocols(klass, fullName) {
      const candidates = Object.keys(klass.$protocols).map((protocolName) => flatProtocolMethods({}, klass.$protocols[protocolName])).reduce((allMethods, methods) => {
        Object.assign(allMethods, methods);
        return allMethods;
      }, {});
      const method2 = candidates[fullName];
      if (method2 === void 0) {
        return null;
      }
      return method2.types;
    }
    function flatProtocolMethods(result, protocol2) {
      if (protocol2.methods !== void 0) {
        Object.assign(result, protocol2.methods);
      }
      if (protocol2.protocol !== void 0) {
        flatProtocolMethods(result, protocol2.protocol);
      }
      return result;
    }
    function findProtocolMethod(rawName) {
      const protocolMethods = allProtocolMethods();
      const details = protocolMethods[rawName];
      return details !== void 0 ? details : null;
    }
    function allProtocolMethods() {
      if (cachedProtocolMethods === null) {
        const methods = {};
        const protocols = collectProtocols(protocol);
        const defaultKind = isClass() ? "+" : "-";
        Object.keys(protocols).forEach(function(name) {
          const p = protocols[name];
          const m2 = p.methods;
          Object.keys(m2).forEach(function(fullMethodName) {
            const method2 = m2[fullMethodName];
            const methodName = fullMethodName.substr(2);
            const kind = fullMethodName[0];
            let didCheckImplemented = false;
            let implemented = false;
            const details = {
              types: method2.types
            };
            Object.defineProperty(details, "implemented", {
              get() {
                if (!didCheckImplemented) {
                  if (method2.required) {
                    implemented = true;
                  } else {
                    implemented = respondsToSelector !== null && respondsToSelector.call(self, selector(methodName));
                  }
                  didCheckImplemented = true;
                }
                return implemented;
              }
            });
            methods[fullMethodName] = details;
            if (kind === defaultKind)
              methods[jsMethodName(methodName)] = details;
          });
        });
        cachedProtocolMethods = methods;
      }
      return cachedProtocolMethods;
    }
    function findMethodWrapper(name) {
      const method2 = findMethod(name);
      if (method2 === null)
        return null;
      let wrapper = method2.wrapper;
      if (wrapper === null) {
        wrapper = makeMethodInvocationWrapper(method2, self, superSpecifier2, defaultInvocationOptions);
        method2.wrapper = wrapper;
      }
      return wrapper;
    }
    function parseMethodName(rawName) {
      const match = /([+\-])\s(\S+)/.exec(rawName);
      let name, kind;
      if (match === null) {
        kind = isClass() ? "+" : "-";
        name = objcMethodName(rawName);
      } else {
        kind = match[1];
        name = match[2];
      }
      const fullName = [kind, name].join(" ");
      return [kind, name, fullName];
    }
    function toJSON2() {
      return {
        handle: handle2.toString()
      };
    }
    function equals2(ptr2) {
      return handle2.equals(getHandle(ptr2));
    }
  }
  function getReplacementMethodImplementation(methodHandle) {
    const existingEntry = replacedMethods.get(methodHandle.toString());
    if (existingEntry === void 0)
      return null;
    const [, newImp] = existingEntry;
    return newImp;
  }
  function replaceMethodImplementation(methodHandle, imp) {
    const key = methodHandle.toString();
    let oldImp;
    const existingEntry = replacedMethods.get(key);
    if (existingEntry !== void 0)
      [oldImp] = existingEntry;
    else
      oldImp = api.method_getImplementation(methodHandle);
    if (!imp.equals(oldImp))
      replacedMethods.set(key, [oldImp, imp]);
    else
      replacedMethods.delete(key);
    api.method_setImplementation(methodHandle, imp);
  }
  function collectMethodNames(klass, prefix) {
    const names = [];
    const numMethodsBuf = Memory.alloc(pointerSize);
    const methodHandles = api.class_copyMethodList(klass, numMethodsBuf);
    try {
      const numMethods = numMethodsBuf.readUInt();
      for (let i = 0; i !== numMethods; i++) {
        const methodHandle = methodHandles.add(i * pointerSize).readPointer();
        const sel2 = api.method_getName(methodHandle);
        const nativeName = api.sel_getName(sel2).readUtf8String();
        names.push(prefix + nativeName);
      }
    } finally {
      api.free(methodHandles);
    }
    return names;
  }
  function ObjCProtocol(handle2) {
    let cachedName = null;
    let cachedProtocols = null;
    let cachedProperties = null;
    let cachedMethods = null;
    Object.defineProperty(this, "handle", {
      value: handle2,
      enumerable: true
    });
    Object.defineProperty(this, "name", {
      get() {
        if (cachedName === null)
          cachedName = api.protocol_getName(handle2).readUtf8String();
        return cachedName;
      },
      enumerable: true
    });
    Object.defineProperty(this, "protocols", {
      get() {
        if (cachedProtocols === null) {
          cachedProtocols = {};
          const numProtocolsBuf = Memory.alloc(pointerSize);
          const protocolHandles = api.protocol_copyProtocolList(handle2, numProtocolsBuf);
          if (!protocolHandles.isNull()) {
            try {
              const numProtocols = numProtocolsBuf.readUInt();
              for (let i = 0; i !== numProtocols; i++) {
                const protocolHandle = protocolHandles.add(i * pointerSize).readPointer();
                const protocol = new ObjCProtocol(protocolHandle);
                cachedProtocols[protocol.name] = protocol;
              }
            } finally {
              api.free(protocolHandles);
            }
          }
        }
        return cachedProtocols;
      },
      enumerable: true
    });
    Object.defineProperty(this, "properties", {
      get() {
        if (cachedProperties === null) {
          cachedProperties = {};
          const numBuf = Memory.alloc(pointerSize);
          const propertyHandles = api.protocol_copyPropertyList(handle2, numBuf);
          if (!propertyHandles.isNull()) {
            try {
              const numProperties = numBuf.readUInt();
              for (let i = 0; i !== numProperties; i++) {
                const propertyHandle = propertyHandles.add(i * pointerSize).readPointer();
                const propName = api.property_getName(propertyHandle).readUtf8String();
                const attributes = {};
                const attributeEntries = api.property_copyAttributeList(propertyHandle, numBuf);
                if (!attributeEntries.isNull()) {
                  try {
                    const numAttributeValues = numBuf.readUInt();
                    for (let j = 0; j !== numAttributeValues; j++) {
                      const attributeEntry = attributeEntries.add(j * (2 * pointerSize));
                      const name = attributeEntry.readPointer().readUtf8String();
                      const value = attributeEntry.add(pointerSize).readPointer().readUtf8String();
                      attributes[name] = value;
                    }
                  } finally {
                    api.free(attributeEntries);
                  }
                }
                cachedProperties[propName] = attributes;
              }
            } finally {
              api.free(propertyHandles);
            }
          }
        }
        return cachedProperties;
      },
      enumerable: true
    });
    Object.defineProperty(this, "methods", {
      get() {
        if (cachedMethods === null) {
          cachedMethods = {};
          const numBuf = Memory.alloc(pointerSize);
          collectMethods(cachedMethods, numBuf, { required: true, instance: false });
          collectMethods(cachedMethods, numBuf, { required: false, instance: false });
          collectMethods(cachedMethods, numBuf, { required: true, instance: true });
          collectMethods(cachedMethods, numBuf, { required: false, instance: true });
        }
        return cachedMethods;
      },
      enumerable: true
    });
    function collectMethods(methods, numBuf, spec) {
      const methodDescValues = api.protocol_copyMethodDescriptionList(handle2, spec.required ? 1 : 0, spec.instance ? 1 : 0, numBuf);
      if (methodDescValues.isNull())
        return;
      try {
        const numMethodDescValues = numBuf.readUInt();
        for (let i = 0; i !== numMethodDescValues; i++) {
          const methodDesc = methodDescValues.add(i * (2 * pointerSize));
          const name = (spec.instance ? "- " : "+ ") + selectorAsString(methodDesc.readPointer());
          const types2 = methodDesc.add(pointerSize).readPointer().readUtf8String();
          methods[name] = {
            required: spec.required,
            types: types2
          };
        }
      } finally {
        api.free(methodDescValues);
      }
    }
  }
  const objCIvarsBuiltins = /* @__PURE__ */ new Set([
    "prototype",
    "constructor",
    "hasOwnProperty",
    "toJSON",
    "toString",
    "valueOf"
  ]);
  function ObjCIvars(instance, classHandle) {
    const ivars = {};
    let cachedIvarNames = null;
    let classHandles = [];
    let currentClassHandle = classHandle;
    do {
      classHandles.unshift(currentClassHandle);
      currentClassHandle = api.class_getSuperclass(currentClassHandle);
    } while (!currentClassHandle.isNull());
    const numIvarsBuf = Memory.alloc(pointerSize);
    classHandles.forEach((c) => {
      const ivarHandles = api.class_copyIvarList(c, numIvarsBuf);
      try {
        const numIvars = numIvarsBuf.readUInt();
        for (let i = 0; i !== numIvars; i++) {
          const handle2 = ivarHandles.add(i * pointerSize).readPointer();
          const name = api.ivar_getName(handle2).readUtf8String();
          ivars[name] = [handle2, null];
        }
      } finally {
        api.free(ivarHandles);
      }
    });
    const self = new Proxy(this, {
      has(target, property) {
        return hasProperty(property);
      },
      get(target, property, receiver) {
        switch (property) {
          case "prototype":
            return target.prototype;
          case "constructor":
            return target.constructor;
          case "hasOwnProperty":
            return hasProperty;
          case "toJSON":
            return toJSON2;
          case "toString":
            return toString2;
          case "valueOf":
            return valueOf;
          default:
            const ivar = findIvar(property);
            if (ivar === null)
              return void 0;
            return ivar.get();
        }
      },
      set(target, property, value, receiver) {
        const ivar = findIvar(property);
        if (ivar === null)
          throw new Error("Unknown ivar");
        ivar.set(value);
        return true;
      },
      ownKeys(target) {
        if (cachedIvarNames === null)
          cachedIvarNames = Object.keys(ivars);
        return cachedIvarNames;
      },
      getOwnPropertyDescriptor(target, property) {
        return {
          writable: true,
          configurable: true,
          enumerable: true
        };
      }
    });
    return self;
    function findIvar(name) {
      const entry = ivars[name];
      if (entry === void 0)
        return null;
      let impl = entry[1];
      if (impl === null) {
        const ivar = entry[0];
        const offset = api.ivar_getOffset(ivar).toInt32();
        const address = instance.handle.add(offset);
        const type = parseType(api.ivar_getTypeEncoding(ivar).readUtf8String());
        const fromNative = type.fromNative || identityTransform;
        const toNative = type.toNative || identityTransform;
        let read2, write3;
        if (name === "isa") {
          read2 = readObjectIsa;
          write3 = function() {
            throw new Error("Unable to set the isa instance variable");
          };
        } else {
          read2 = type.read;
          write3 = type.write;
        }
        impl = {
          get() {
            return fromNative.call(instance, read2(address));
          },
          set(value) {
            write3(address, toNative.call(instance, value));
          }
        };
        entry[1] = impl;
      }
      return impl;
    }
    function hasProperty(name) {
      if (objCIvarsBuiltins.has(name))
        return true;
      return ivars.hasOwnProperty(name);
    }
    function toJSON2() {
      return Object.keys(self).reduce(function(result, name) {
        result[name] = self[name];
        return result;
      }, {});
    }
    function toString2() {
      return "ObjCIvars";
    }
    function valueOf() {
      return "ObjCIvars";
    }
  }
  let blockDescriptorAllocSize, blockDescriptorDeclaredSize, blockDescriptorOffsets;
  let blockSize, blockOffsets;
  if (pointerSize === 4) {
    blockDescriptorAllocSize = 16;
    blockDescriptorDeclaredSize = 20;
    blockDescriptorOffsets = {
      reserved: 0,
      size: 4,
      rest: 8
    };
    blockSize = 20;
    blockOffsets = {
      isa: 0,
      flags: 4,
      reserved: 8,
      invoke: 12,
      descriptor: 16
    };
  } else {
    blockDescriptorAllocSize = 32;
    blockDescriptorDeclaredSize = 32;
    blockDescriptorOffsets = {
      reserved: 0,
      size: 8,
      rest: 16
    };
    blockSize = 32;
    blockOffsets = {
      isa: 0,
      flags: 8,
      reserved: 12,
      invoke: 16,
      descriptor: 24
    };
  }
  const BLOCK_HAS_COPY_DISPOSE = 1 << 25;
  const BLOCK_HAS_CTOR = 1 << 26;
  const BLOCK_IS_GLOBAL = 1 << 28;
  const BLOCK_HAS_STRET = 1 << 29;
  const BLOCK_HAS_SIGNATURE = 1 << 30;
  function Block(target, options = defaultInvocationOptions) {
    this._options = options;
    if (target instanceof NativePointer) {
      const descriptor = target.add(blockOffsets.descriptor).readPointer();
      this.handle = target;
      const flags = target.add(blockOffsets.flags).readU32();
      if ((flags & BLOCK_HAS_SIGNATURE) !== 0) {
        const signatureOffset = (flags & BLOCK_HAS_COPY_DISPOSE) !== 0 ? 2 : 0;
        this.types = descriptor.add(blockDescriptorOffsets.rest + signatureOffset * pointerSize).readPointer().readCString();
        this._signature = parseSignature(this.types);
      } else {
        this._signature = null;
      }
    } else {
      this.declare(target);
      const descriptor = Memory.alloc(blockDescriptorAllocSize + blockSize);
      const block2 = descriptor.add(blockDescriptorAllocSize);
      const typesStr = Memory.allocUtf8String(this.types);
      descriptor.add(blockDescriptorOffsets.reserved).writeULong(0);
      descriptor.add(blockDescriptorOffsets.size).writeULong(blockDescriptorDeclaredSize);
      descriptor.add(blockDescriptorOffsets.rest).writePointer(typesStr);
      block2.add(blockOffsets.isa).writePointer(classRegistry.__NSGlobalBlock__);
      block2.add(blockOffsets.flags).writeU32(BLOCK_HAS_SIGNATURE | BLOCK_IS_GLOBAL);
      block2.add(blockOffsets.reserved).writeU32(0);
      block2.add(blockOffsets.descriptor).writePointer(descriptor);
      this.handle = block2;
      this._storage = [descriptor, typesStr];
      this.implementation = target.implementation;
    }
  }
  Object.defineProperties(Block.prototype, {
    implementation: {
      enumerable: true,
      get() {
        const address = this.handle.add(blockOffsets.invoke).readPointer().strip();
        const signature2 = this._getSignature();
        return makeBlockInvocationWrapper(this, signature2, new NativeFunction(
          address.sign(),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          }),
          this._options
        ));
      },
      set(func) {
        const signature2 = this._getSignature();
        const callback = new NativeCallback(
          makeBlockImplementationWrapper(this, signature2, func),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          })
        );
        this._callback = callback;
        const location = this.handle.add(blockOffsets.invoke);
        const prot = Memory.queryProtection(location);
        const writable = prot.includes("w");
        if (!writable)
          Memory.protect(location, Process.pointerSize, "rw-");
        location.writePointer(callback.strip().sign("ia", location));
        if (!writable)
          Memory.protect(location, Process.pointerSize, prot);
      }
    },
    declare: {
      value(signature2) {
        let types2 = signature2.types;
        if (types2 === void 0) {
          types2 = unparseSignature(signature2.retType, ["block"].concat(signature2.argTypes));
        }
        this.types = types2;
        this._signature = parseSignature(types2);
      }
    },
    _getSignature: {
      value() {
        const signature2 = this._signature;
        if (signature2 === null)
          throw new Error("block is missing signature; call declare()");
        return signature2;
      }
    }
  });
  function collectProtocols(p, acc) {
    acc = acc || {};
    acc[p.name] = p;
    const parentProtocols = p.protocols;
    Object.keys(parentProtocols).forEach(function(name) {
      collectProtocols(parentProtocols[name], acc);
    });
    return acc;
  }
  function registerProxy(properties) {
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    const events = properties.events || {};
    const supportedSelectors = new Set(
      Object.keys(methods).filter((m2) => /([+\-])\s(\S+)/.exec(m2) !== null).map((m2) => m2.split(" ")[1])
    );
    const proxyMethods = {
      "- dealloc": function() {
        const target = this.data.target;
        if ("- release" in target)
          target.release();
        unbind(this.self);
        this.super.dealloc();
        const callback = this.data.events.dealloc;
        if (callback !== void 0)
          callback.call(this);
      },
      "- respondsToSelector:": function(sel2) {
        const selector2 = selectorAsString(sel2);
        if (supportedSelectors.has(selector2))
          return true;
        return this.data.target.respondsToSelector_(sel2);
      },
      "- forwardingTargetForSelector:": function(sel2) {
        const callback = this.data.events.forward;
        if (callback !== void 0)
          callback.call(this, selectorAsString(sel2));
        return this.data.target;
      },
      "- methodSignatureForSelector:": function(sel2) {
        return this.data.target.methodSignatureForSelector_(sel2);
      },
      "- forwardInvocation:": function(invocation) {
        invocation.invokeWithTarget_(this.data.target);
      }
    };
    for (var key in methods) {
      if (methods.hasOwnProperty(key)) {
        if (proxyMethods.hasOwnProperty(key))
          throw new Error("The '" + key + "' method is reserved");
        proxyMethods[key] = methods[key];
      }
    }
    const ProxyClass = registerClass({
      name: properties.name,
      super: classRegistry.NSProxy,
      protocols,
      methods: proxyMethods
    });
    return function(target, data) {
      target = target instanceof NativePointer ? new ObjCObject(target) : target;
      data = data || {};
      const instance = ProxyClass.alloc().autorelease();
      const boundData = getBoundData(instance);
      boundData.target = "- retain" in target ? target.retain() : target;
      boundData.events = events;
      for (var key2 in data) {
        if (data.hasOwnProperty(key2)) {
          if (boundData.hasOwnProperty(key2))
            throw new Error("The '" + key2 + "' property is reserved");
          boundData[key2] = data[key2];
        }
      }
      this.handle = instance.handle;
    };
  }
  function registerClass(properties) {
    let name = properties.name;
    if (name === void 0)
      name = makeClassName();
    const superClass = properties.super !== void 0 ? properties.super : classRegistry.NSObject;
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    const methodCallbacks = [];
    const classHandle = api.objc_allocateClassPair(superClass !== null ? superClass.handle : NULL, Memory.allocUtf8String(name), ptr("0"));
    if (classHandle.isNull())
      throw new Error("Unable to register already registered class '" + name + "'");
    const metaClassHandle = api.object_getClass(classHandle);
    try {
      protocols.forEach(function(protocol) {
        api.class_addProtocol(classHandle, protocol.handle);
      });
      Object.keys(methods).forEach(function(rawMethodName) {
        const match = /([+\-])\s(\S+)/.exec(rawMethodName);
        if (match === null)
          throw new Error("Invalid method name");
        const kind = match[1];
        const name2 = match[2];
        let method2;
        const value = methods[rawMethodName];
        if (typeof value === "function") {
          let types3 = null;
          if (rawMethodName in superClass) {
            types3 = superClass[rawMethodName].types;
          } else {
            for (let protocol of protocols) {
              const method3 = protocol.methods[rawMethodName];
              if (method3 !== void 0) {
                types3 = method3.types;
                break;
              }
            }
          }
          if (types3 === null)
            throw new Error("Unable to find '" + rawMethodName + "' in super-class or any of its protocols");
          method2 = {
            types: types3,
            implementation: value
          };
        } else {
          method2 = value;
        }
        const target = kind === "+" ? metaClassHandle : classHandle;
        let types2 = method2.types;
        if (types2 === void 0) {
          types2 = unparseSignature(method2.retType, [kind === "+" ? "class" : "object", "selector"].concat(method2.argTypes));
        }
        const signature2 = parseSignature(types2);
        const implementation2 = new NativeCallback(
          makeMethodImplementationWrapper(signature2, method2.implementation),
          signature2.retType.type,
          signature2.argTypes.map(function(arg) {
            return arg.type;
          })
        );
        methodCallbacks.push(implementation2);
        api.class_addMethod(target, selector(name2), implementation2, Memory.allocUtf8String(types2));
      });
    } catch (e) {
      api.objc_disposeClassPair(classHandle);
      throw e;
    }
    api.objc_registerClassPair(classHandle);
    classHandle._methodCallbacks = methodCallbacks;
    Script.bindWeak(classHandle, makeClassDestructor(ptr(classHandle)));
    return new ObjCObject(classHandle);
  }
  function makeClassDestructor(classHandle) {
    return function() {
      api.objc_disposeClassPair(classHandle);
    };
  }
  function registerProtocol(properties) {
    let name = properties.name;
    if (name === void 0)
      name = makeProtocolName();
    const protocols = properties.protocols || [];
    const methods = properties.methods || {};
    protocols.forEach(function(protocol) {
      if (!(protocol instanceof ObjCProtocol))
        throw new Error("Expected protocol");
    });
    const methodSpecs = Object.keys(methods).map(function(rawMethodName) {
      const method2 = methods[rawMethodName];
      const match = /([+\-])\s(\S+)/.exec(rawMethodName);
      if (match === null)
        throw new Error("Invalid method name");
      const kind = match[1];
      const name2 = match[2];
      let types2 = method2.types;
      if (types2 === void 0) {
        types2 = unparseSignature(method2.retType, [kind === "+" ? "class" : "object", "selector"].concat(method2.argTypes));
      }
      return {
        kind,
        name: name2,
        types: types2,
        optional: method2.optional
      };
    });
    const handle2 = api.objc_allocateProtocol(Memory.allocUtf8String(name));
    if (handle2.isNull())
      throw new Error("Unable to register already registered protocol '" + name + "'");
    protocols.forEach(function(protocol) {
      api.protocol_addProtocol(handle2, protocol.handle);
    });
    methodSpecs.forEach(function(spec) {
      const isRequiredMethod = spec.optional ? 0 : 1;
      const isInstanceMethod = spec.kind === "-" ? 1 : 0;
      api.protocol_addMethodDescription(handle2, selector(spec.name), Memory.allocUtf8String(spec.types), isRequiredMethod, isInstanceMethod);
    });
    api.objc_registerProtocol(handle2);
    return new ObjCProtocol(handle2);
  }
  function getHandle(obj) {
    if (obj instanceof NativePointer)
      return obj;
    else if (typeof obj === "object" && obj.hasOwnProperty("handle"))
      return obj.handle;
    else
      throw new Error("Expected NativePointer or ObjC.Object instance");
  }
  function bind(obj, data) {
    const handle2 = getHandle(obj);
    const self = obj instanceof ObjCObject ? obj : new ObjCObject(handle2);
    bindings.set(handle2.toString(), {
      self,
      super: self.$super,
      data
    });
  }
  function unbind(obj) {
    const handle2 = getHandle(obj);
    bindings.delete(handle2.toString());
  }
  function getBoundData(obj) {
    return getBinding(obj).data;
  }
  function getBinding(obj) {
    const handle2 = getHandle(obj);
    const key = handle2.toString();
    let binding = bindings.get(key);
    if (binding === void 0) {
      const self = obj instanceof ObjCObject ? obj : new ObjCObject(handle2);
      binding = {
        self,
        super: self.$super,
        data: {}
      };
      bindings.set(key, binding);
    }
    return binding;
  }
  function enumerateLoadedClasses(...args) {
    const allModules = new ModuleMap();
    let unfiltered = false;
    let callbacks;
    let modules;
    if (args.length === 1) {
      callbacks = args[0];
    } else {
      callbacks = args[1];
      const options = args[0];
      modules = options.ownedBy;
    }
    if (modules === void 0) {
      modules = allModules;
      unfiltered = true;
    }
    const classGetName = api.class_getName;
    const onMatch = callbacks.onMatch.bind(callbacks);
    const swiftNominalTypeDescriptorOffset = (pointerSize === 8 ? 8 : 11) * pointerSize;
    const numClasses = api.objc_getClassList(NULL, 0);
    const classHandles = Memory.alloc(numClasses * pointerSize);
    api.objc_getClassList(classHandles, numClasses);
    for (let i = 0; i !== numClasses; i++) {
      const classHandle = classHandles.add(i * pointerSize).readPointer();
      const rawName = classGetName(classHandle);
      let name = null;
      let modulePath = modules.findPath(rawName);
      const possiblySwift = modulePath === null && (unfiltered || allModules.findPath(rawName) === null);
      if (possiblySwift) {
        name = rawName.readCString();
        const probablySwift = name.indexOf(".") !== -1;
        if (probablySwift) {
          const nominalTypeDescriptor = classHandle.add(swiftNominalTypeDescriptorOffset).readPointer();
          modulePath = modules.findPath(nominalTypeDescriptor);
        }
      }
      if (modulePath !== null) {
        if (name === null)
          name = rawName.readUtf8String();
        onMatch(name, modulePath);
      }
    }
    callbacks.onComplete();
  }
  function enumerateLoadedClassesSync(options = {}) {
    const result = {};
    enumerateLoadedClasses(options, {
      onMatch(name, owner2) {
        let group = result[owner2];
        if (group === void 0) {
          group = [];
          result[owner2] = group;
        }
        group.push(name);
      },
      onComplete() {
      }
    });
    return result;
  }
  function choose(specifier, callbacks) {
    let cls = specifier;
    let subclasses = true;
    if (!(specifier instanceof ObjCObject) && typeof specifier === "object") {
      cls = specifier.class;
      if (specifier.hasOwnProperty("subclasses"))
        subclasses = specifier.subclasses;
    }
    if (!(cls instanceof ObjCObject && (cls.$kind === "class" || cls.$kind === "meta-class")))
      throw new Error("Expected an ObjC.Object for a class or meta-class");
    const matches = get().choose(cls, subclasses).map((handle2) => new ObjCObject(handle2));
    for (const match of matches) {
      const result = callbacks.onMatch(match);
      if (result === "stop")
        break;
    }
    callbacks.onComplete();
  }
  function makeMethodInvocationWrapper(method, owner, superSpecifier, invocationOptions) {
    const sel = method.sel;
    let handle = method.handle;
    let types;
    if (handle === void 0) {
      handle = null;
      types = method.types;
    } else {
      types = api.method_getTypeEncoding(handle).readUtf8String();
    }
    const signature = parseSignature(types);
    const retType = signature.retType;
    const argTypes = signature.argTypes.slice(2);
    const objc_msgSend = superSpecifier ? getMsgSendSuperImpl(signature, invocationOptions) : getMsgSendImpl(signature, invocationOptions);
    const argVariableNames = argTypes.map(function(t, i) {
      return "a" + (i + 1);
    });
    const callArgs = [
      superSpecifier ? "superSpecifier" : "this",
      "sel"
    ].concat(argTypes.map(function(t, i) {
      if (t.toNative) {
        return "argTypes[" + i + "].toNative.call(this, " + argVariableNames[i] + ")";
      }
      return argVariableNames[i];
    }));
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.fromNative) {
      returnCaptureLeft = "return retType.fromNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const m = eval("var m = function (" + argVariableNames.join(", ") + ") { " + returnCaptureLeft + "objc_msgSend(" + callArgs.join(", ") + ")" + returnCaptureRight + "; }; m;");
    Object.defineProperty(m, "handle", {
      enumerable: true,
      get: getMethodHandle
    });
    m.selector = sel;
    Object.defineProperty(m, "implementation", {
      enumerable: true,
      get() {
        const h = getMethodHandle();
        const impl = new NativeFunction(api.method_getImplementation(h), m.returnType, m.argumentTypes, invocationOptions);
        const newImp = getReplacementMethodImplementation(h);
        if (newImp !== null)
          impl._callback = newImp;
        return impl;
      },
      set(imp) {
        replaceMethodImplementation(getMethodHandle(), imp);
      }
    });
    m.returnType = retType.type;
    m.argumentTypes = signature.argTypes.map((t) => t.type);
    m.types = types;
    Object.defineProperty(m, "symbol", {
      enumerable: true,
      get() {
        return `${method.kind}[${owner.$className} ${selectorAsString(sel)}]`;
      }
    });
    m.clone = function(options) {
      return makeMethodInvocationWrapper(method, owner, superSpecifier, options);
    };
    function getMethodHandle() {
      if (handle === null) {
        if (owner.$kind === "instance") {
          let cur = owner;
          do {
            if ("- forwardingTargetForSelector:" in cur) {
              const target = cur.forwardingTargetForSelector_(sel);
              if (target === null)
                break;
              if (target.$kind !== "instance")
                break;
              const h = api.class_getInstanceMethod(target.$class.handle, sel);
              if (!h.isNull())
                handle = h;
              else
                cur = target;
            } else {
              break;
            }
          } while (handle === null);
        }
        if (handle === null)
          throw new Error("Unable to find method handle of proxied function");
      }
      return handle;
    }
    return m;
  }
  function makeMethodImplementationWrapper(signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes;
    const argVariableNames = argTypes.map(function(t, i) {
      if (i === 0)
        return "handle";
      else if (i === 1)
        return "sel";
      else
        return "a" + (i - 1);
    });
    const callArgs = argTypes.slice(2).map(function(t, i) {
      const argVariableName = argVariableNames[2 + i];
      if (t.fromNative) {
        return "argTypes[" + (2 + i) + "].fromNative.call(self, " + argVariableName + ")";
      }
      return argVariableName;
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.toNative) {
      returnCaptureLeft = "return retType.toNative.call(self, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const m = eval("var m = function (" + argVariableNames.join(", ") + ") { var binding = getBinding(handle);var self = binding.self;" + returnCaptureLeft + "implementation.call(binding" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; m;");
    return m;
  }
  function makeBlockInvocationWrapper(block, signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes.slice(1);
    const argVariableNames = argTypes.map(function(t, i) {
      return "a" + (i + 1);
    });
    const callArgs = argTypes.map(function(t, i) {
      if (t.toNative) {
        return "argTypes[" + i + "].toNative.call(this, " + argVariableNames[i] + ")";
      }
      return argVariableNames[i];
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.fromNative) {
      returnCaptureLeft = "return retType.fromNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const f = eval("var f = function (" + argVariableNames.join(", ") + ") { " + returnCaptureLeft + "implementation(this" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; f;");
    return f.bind(block);
  }
  function makeBlockImplementationWrapper(block, signature, implementation) {
    const retType = signature.retType;
    const argTypes = signature.argTypes;
    const argVariableNames = argTypes.map(function(t, i) {
      if (i === 0)
        return "handle";
      else
        return "a" + i;
    });
    const callArgs = argTypes.slice(1).map(function(t, i) {
      const argVariableName = argVariableNames[1 + i];
      if (t.fromNative) {
        return "argTypes[" + (1 + i) + "].fromNative.call(this, " + argVariableName + ")";
      }
      return argVariableName;
    });
    let returnCaptureLeft;
    let returnCaptureRight;
    if (retType.type === "void") {
      returnCaptureLeft = "";
      returnCaptureRight = "";
    } else if (retType.toNative) {
      returnCaptureLeft = "return retType.toNative.call(this, ";
      returnCaptureRight = ")";
    } else {
      returnCaptureLeft = "return ";
      returnCaptureRight = "";
    }
    const f = eval("var f = function (" + argVariableNames.join(", ") + ") { if (!this.handle.equals(handle))this.handle = handle;" + returnCaptureLeft + "implementation.call(block" + (callArgs.length > 0 ? ", " : "") + callArgs.join(", ") + ")" + returnCaptureRight + "; }; f;");
    return f.bind(block);
  }
  function rawFridaType(t) {
    return t === "object" ? "pointer" : t;
  }
  function makeClassName() {
    for (let i = 1; true; i++) {
      const name = "FridaAnonymousClass" + i;
      if (!(name in classRegistry)) {
        return name;
      }
    }
  }
  function makeProtocolName() {
    for (let i = 1; true; i++) {
      const name = "FridaAnonymousProtocol" + i;
      if (!(name in protocolRegistry)) {
        return name;
      }
    }
  }
  function objcMethodName(name) {
    return name.replace(/_/g, ":");
  }
  function jsMethodName(name) {
    let result = name.replace(/:/g, "_");
    if (objCObjectBuiltins.has(result))
      result += "2";
    return result;
  }
  const isaMasks = {
    x64: "0x7ffffffffff8",
    arm64: "0xffffffff8"
  };
  const rawMask = isaMasks[Process.arch];
  if (rawMask !== void 0) {
    const mask = ptr(rawMask);
    readObjectIsa = function(p) {
      return p.readPointer().and(mask);
    };
  } else {
    readObjectIsa = function(p) {
      return p.readPointer();
    };
  }
  function getMsgSendImpl(signature2, invocationOptions2) {
    return resolveMsgSendImpl(msgSendBySignatureId, signature2, invocationOptions2, false);
  }
  function getMsgSendSuperImpl(signature2, invocationOptions2) {
    return resolveMsgSendImpl(msgSendSuperBySignatureId, signature2, invocationOptions2, true);
  }
  function resolveMsgSendImpl(cache, signature2, invocationOptions2, isSuper) {
    if (invocationOptions2 !== defaultInvocationOptions)
      return makeMsgSendImpl(signature2, invocationOptions2, isSuper);
    const { id } = signature2;
    let impl = cache.get(id);
    if (impl === void 0) {
      impl = makeMsgSendImpl(signature2, invocationOptions2, isSuper);
      cache.set(id, impl);
    }
    return impl;
  }
  function makeMsgSendImpl(signature2, invocationOptions2, isSuper) {
    const retType2 = signature2.retType.type;
    const argTypes2 = signature2.argTypes.map(function(t) {
      return t.type;
    });
    const components = ["objc_msgSend"];
    if (isSuper)
      components.push("Super");
    const returnsStruct = retType2 instanceof Array;
    if (returnsStruct && !typeFitsInRegisters(retType2))
      components.push("_stret");
    else if (retType2 === "float" || retType2 === "double")
      components.push("_fpret");
    const name = components.join("");
    return new NativeFunction(api[name], retType2, argTypes2, invocationOptions2);
  }
  function typeFitsInRegisters(type) {
    if (Process.arch !== "x64")
      return false;
    const size = sizeOfTypeOnX64(type);
    return size <= 16;
  }
  function sizeOfTypeOnX64(type) {
    if (type instanceof Array)
      return type.reduce((total, field) => total + sizeOfTypeOnX64(field), 0);
    switch (type) {
      case "bool":
      case "char":
      case "uchar":
        return 1;
      case "int16":
      case "uint16":
        return 2;
      case "int":
      case "int32":
      case "uint":
      case "uint32":
      case "float":
        return 4;
      default:
        return 8;
    }
  }
  function unparseSignature(retType2, argTypes2) {
    const retTypeId = typeIdFromAlias(retType2);
    const argTypeIds = argTypes2.map(typeIdFromAlias);
    const argSizes = argTypeIds.map((id) => singularTypeById[id].size);
    const frameSize = argSizes.reduce((total, size) => total + size, 0);
    let frameOffset = 0;
    return retTypeId + frameSize + argTypeIds.map((id, i) => {
      const result = id + frameOffset;
      frameOffset += argSizes[i];
      return result;
    }).join("");
  }
  function parseSignature(sig) {
    const cursor = [sig, 0];
    parseQualifiers(cursor);
    const retType2 = readType(cursor);
    readNumber(cursor);
    const argTypes2 = [];
    let id = JSON.stringify(retType2.type);
    while (dataAvailable(cursor)) {
      parseQualifiers(cursor);
      const argType = readType(cursor);
      readNumber(cursor);
      argTypes2.push(argType);
      id += JSON.stringify(argType.type);
    }
    return {
      id,
      retType: retType2,
      argTypes: argTypes2
    };
  }
  function parseType(type) {
    const cursor = [type, 0];
    return readType(cursor);
  }
  function readType(cursor) {
    let id = readChar(cursor);
    if (id === "@") {
      let next = peekChar(cursor);
      if (next === "?") {
        id += next;
        skipChar(cursor);
        if (peekChar(cursor) === "<")
          skipExtendedBlock(cursor);
      } else if (next === '"') {
        skipChar(cursor);
        readUntil('"', cursor);
      }
    } else if (id === "^") {
      let next = peekChar(cursor);
      if (next === "@") {
        id += next;
        skipChar(cursor);
      }
    }
    const type = singularTypeById[id];
    if (type !== void 0) {
      return type;
    } else if (id === "[") {
      const length = readNumber(cursor);
      const elementType = readType(cursor);
      skipChar(cursor);
      return arrayType(length, elementType);
    } else if (id === "{") {
      if (!tokenExistsAhead("=", "}", cursor)) {
        readUntil("}", cursor);
        return structType([]);
      }
      readUntil("=", cursor);
      const structFields = [];
      let ch;
      while ((ch = peekChar(cursor)) !== "}") {
        if (ch === '"') {
          skipChar(cursor);
          readUntil('"', cursor);
        }
        structFields.push(readType(cursor));
      }
      skipChar(cursor);
      return structType(structFields);
    } else if (id === "(") {
      readUntil("=", cursor);
      const unionFields = [];
      while (peekChar(cursor) !== ")")
        unionFields.push(readType(cursor));
      skipChar(cursor);
      return unionType(unionFields);
    } else if (id === "b") {
      readNumber(cursor);
      return singularTypeById.i;
    } else if (id === "^") {
      readType(cursor);
      return singularTypeById["?"];
    } else if (modifiers.has(id)) {
      return readType(cursor);
    } else {
      throw new Error("Unable to handle type " + id);
    }
  }
  function skipExtendedBlock(cursor) {
    let ch;
    skipChar(cursor);
    while ((ch = peekChar(cursor)) !== ">") {
      if (peekChar(cursor) === "<") {
        skipExtendedBlock(cursor);
      } else {
        skipChar(cursor);
        if (ch === '"')
          readUntil('"', cursor);
      }
    }
    skipChar(cursor);
  }
  function readNumber(cursor) {
    let result = "";
    while (dataAvailable(cursor)) {
      const c = peekChar(cursor);
      const v = c.charCodeAt(0);
      const isDigit = v >= 48 && v <= 57;
      if (isDigit) {
        result += c;
        skipChar(cursor);
      } else {
        break;
      }
    }
    return parseInt(result);
  }
  function readUntil(token, cursor) {
    const buffer = cursor[0];
    const offset = cursor[1];
    const index = buffer.indexOf(token, offset);
    if (index === -1)
      throw new Error("Expected token '" + token + "' not found");
    const result = buffer.substring(offset, index);
    cursor[1] = index + 1;
    return result;
  }
  function readChar(cursor) {
    return cursor[0][cursor[1]++];
  }
  function peekChar(cursor) {
    return cursor[0][cursor[1]];
  }
  function tokenExistsAhead(token, terminator, cursor) {
    const [buffer, offset] = cursor;
    const tokenIndex = buffer.indexOf(token, offset);
    if (tokenIndex === -1)
      return false;
    const terminatorIndex = buffer.indexOf(terminator, offset);
    if (terminatorIndex === -1)
      throw new Error("Expected to find terminator: " + terminator);
    return tokenIndex < terminatorIndex;
  }
  function skipChar(cursor) {
    cursor[1]++;
  }
  function dataAvailable(cursor) {
    return cursor[1] !== cursor[0].length;
  }
  const qualifierById = {
    "r": "const",
    "n": "in",
    "N": "inout",
    "o": "out",
    "O": "bycopy",
    "R": "byref",
    "V": "oneway"
  };
  function parseQualifiers(cursor) {
    const qualifiers = [];
    while (true) {
      const q = qualifierById[peekChar(cursor)];
      if (q === void 0)
        break;
      qualifiers.push(q);
      skipChar(cursor);
    }
    return qualifiers;
  }
  const idByAlias = {
    "char": "c",
    "int": "i",
    "int16": "s",
    "int32": "i",
    "int64": "q",
    "uchar": "C",
    "uint": "I",
    "uint16": "S",
    "uint32": "I",
    "uint64": "Q",
    "float": "f",
    "double": "d",
    "bool": "B",
    "void": "v",
    "string": "*",
    "object": "@",
    "block": "@?",
    "class": "#",
    "selector": ":",
    "pointer": "^v"
  };
  function typeIdFromAlias(alias) {
    if (typeof alias === "object" && alias !== null)
      return `@"${alias.type}"`;
    const id = idByAlias[alias];
    if (id === void 0)
      throw new Error("No known encoding for type " + alias);
    return id;
  }
  const fromNativeId = function(h) {
    if (h.isNull()) {
      return null;
    } else if (h.toString(16) === this.handle.toString(16)) {
      return this;
    } else {
      return new ObjCObject(h);
    }
  };
  const toNativeId = function(v) {
    if (v === null)
      return NULL;
    const type = typeof v;
    if (type === "string") {
      if (cachedNSStringCtor === null) {
        cachedNSString = classRegistry.NSString;
        cachedNSStringCtor = cachedNSString.stringWithUTF8String_;
      }
      return cachedNSStringCtor.call(cachedNSString, Memory.allocUtf8String(v));
    } else if (type === "number") {
      if (cachedNSNumberCtor === null) {
        cachedNSNumber = classRegistry.NSNumber;
        cachedNSNumberCtor = cachedNSNumber.numberWithDouble_;
      }
      return cachedNSNumberCtor.call(cachedNSNumber, v);
    }
    return v;
  };
  const fromNativeBlock = function(h) {
    if (h.isNull()) {
      return null;
    } else if (h.toString(16) === this.handle.toString(16)) {
      return this;
    } else {
      return new Block(h);
    }
  };
  const toNativeBlock = function(v) {
    return v !== null ? v : NULL;
  };
  const toNativeObjectArray = function(v) {
    if (v instanceof Array) {
      const length = v.length;
      const array = Memory.alloc(length * pointerSize);
      for (let i = 0; i !== length; i++)
        array.add(i * pointerSize).writePointer(toNativeId(v[i]));
      return array;
    }
    return v;
  };
  function arrayType(length, elementType) {
    return {
      type: "pointer",
      read(address) {
        const result = [];
        const elementSize = elementType.size;
        for (let index = 0; index !== length; index++) {
          result.push(elementType.read(address.add(index * elementSize)));
        }
        return result;
      },
      write(address, values) {
        const elementSize = elementType.size;
        values.forEach((value, index) => {
          elementType.write(address.add(index * elementSize), value);
        });
      }
    };
  }
  function structType(fieldTypes) {
    let fromNative, toNative;
    if (fieldTypes.some(function(t) {
      return !!t.fromNative;
    })) {
      const fromTransforms = fieldTypes.map(function(t) {
        if (t.fromNative)
          return t.fromNative;
        else
          return identityTransform;
      });
      fromNative = function(v) {
        return v.map(function(e, i) {
          return fromTransforms[i].call(this, e);
        });
      };
    } else {
      fromNative = identityTransform;
    }
    if (fieldTypes.some(function(t) {
      return !!t.toNative;
    })) {
      const toTransforms = fieldTypes.map(function(t) {
        if (t.toNative)
          return t.toNative;
        else
          return identityTransform;
      });
      toNative = function(v) {
        return v.map(function(e, i) {
          return toTransforms[i].call(this, e);
        });
      };
    } else {
      toNative = identityTransform;
    }
    const [totalSize, fieldOffsets] = fieldTypes.reduce(function(result, t) {
      const [previousOffset, offsets] = result;
      const { size } = t;
      const offset = align(previousOffset, size);
      offsets.push(offset);
      return [offset + size, offsets];
    }, [0, []]);
    return {
      type: fieldTypes.map((t) => t.type),
      size: totalSize,
      read(address) {
        return fieldTypes.map((type, index) => type.read(address.add(fieldOffsets[index])));
      },
      write(address, values) {
        values.forEach((value, index) => {
          fieldTypes[index].write(address.add(fieldOffsets[index]), value);
        });
      },
      fromNative,
      toNative
    };
  }
  function unionType(fieldTypes) {
    const largestType = fieldTypes.reduce(function(largest, t) {
      if (t.size > largest.size)
        return t;
      else
        return largest;
    }, fieldTypes[0]);
    let fromNative, toNative;
    if (largestType.fromNative) {
      const fromTransform = largestType.fromNative;
      fromNative = function(v) {
        return fromTransform.call(this, v[0]);
      };
    } else {
      fromNative = function(v) {
        return v[0];
      };
    }
    if (largestType.toNative) {
      const toTransform = largestType.toNative;
      toNative = function(v) {
        return [toTransform.call(this, v)];
      };
    } else {
      toNative = function(v) {
        return [v];
      };
    }
    return {
      type: [largestType.type],
      size: largestType.size,
      read: largestType.read,
      write: largestType.write,
      fromNative,
      toNative
    };
  }
  const longBits = pointerSize == 8 && Process.platform !== "windows" ? 64 : 32;
  modifiers = /* @__PURE__ */ new Set([
    "j",
    // complex
    "A",
    // atomic
    "r",
    // const
    "n",
    // in
    "N",
    // inout
    "o",
    // out
    "O",
    // by copy
    "R",
    // by ref
    "V",
    // one way
    "+"
    // GNU register
  ]);
  singularTypeById = {
    "c": {
      type: "char",
      size: 1,
      read: (address) => address.readS8(),
      write: (address, value) => {
        address.writeS8(value);
      },
      toNative(v) {
        if (typeof v === "boolean") {
          return v ? 1 : 0;
        }
        return v;
      }
    },
    "i": {
      type: "int",
      size: 4,
      read: (address) => address.readInt(),
      write: (address, value) => {
        address.writeInt(value);
      }
    },
    "s": {
      type: "int16",
      size: 2,
      read: (address) => address.readS16(),
      write: (address, value) => {
        address.writeS16(value);
      }
    },
    "l": {
      type: "int32",
      size: 4,
      read: (address) => address.readS32(),
      write: (address, value) => {
        address.writeS32(value);
      }
    },
    "q": {
      type: "int64",
      size: 8,
      read: (address) => address.readS64(),
      write: (address, value) => {
        address.writeS64(value);
      }
    },
    "C": {
      type: "uchar",
      size: 1,
      read: (address) => address.readU8(),
      write: (address, value) => {
        address.writeU8(value);
      }
    },
    "I": {
      type: "uint",
      size: 4,
      read: (address) => address.readUInt(),
      write: (address, value) => {
        address.writeUInt(value);
      }
    },
    "S": {
      type: "uint16",
      size: 2,
      read: (address) => address.readU16(),
      write: (address, value) => {
        address.writeU16(value);
      }
    },
    "L": {
      type: "uint" + longBits,
      size: longBits / 8,
      read: (address) => address.readULong(),
      write: (address, value) => {
        address.writeULong(value);
      }
    },
    "Q": {
      type: "uint64",
      size: 8,
      read: (address) => address.readU64(),
      write: (address, value) => {
        address.writeU64(value);
      }
    },
    "f": {
      type: "float",
      size: 4,
      read: (address) => address.readFloat(),
      write: (address, value) => {
        address.writeFloat(value);
      }
    },
    "d": {
      type: "double",
      size: 8,
      read: (address) => address.readDouble(),
      write: (address, value) => {
        address.writeDouble(value);
      }
    },
    "B": {
      type: "bool",
      size: 1,
      read: (address) => address.readU8(),
      write: (address, value) => {
        address.writeU8(value);
      },
      fromNative(v) {
        return v ? true : false;
      },
      toNative(v) {
        return v ? 1 : 0;
      }
    },
    "v": {
      type: "void",
      size: 0
    },
    "*": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative(h) {
        return h.readUtf8String();
      }
    },
    "@": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeId,
      toNative: toNativeId
    },
    "@?": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeBlock,
      toNative: toNativeBlock
    },
    "^@": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      toNative: toNativeObjectArray
    },
    "^v": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    },
    "#": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      },
      fromNative: fromNativeId,
      toNative: toNativeId
    },
    ":": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    },
    "?": {
      type: "pointer",
      size: pointerSize,
      read: (address) => address.readPointer(),
      write: (address, value) => {
        address.writePointer(value);
      }
    }
  };
  function identityTransform(v) {
    return v;
  }
  function align(value, boundary) {
    const remainder = value % boundary;
    return remainder === 0 ? value : value + (boundary - remainder);
  }
}
var runtime = new Runtime();
var frida_objc_bridge_default = runtime;

// agent/src/lib/systemFunctions.ts
var libXPCDylib = "libxpc.dylib";
var libxpc = Process.getModuleByName(libXPCDylib);
var p_xpc_connection_get_name = libxpc.getExportByName("xpc_connection_get_name");
var p_xpc_dictionary_apply = libxpc.getExportByName("xpc_dictionary_apply");
var p_xpc_get_type = libxpc.getExportByName("xpc_get_type");
var p_xpc_data_get_bytes_ptr = libxpc.getExportByName("xpc_data_get_bytes_ptr");
var p_xpc_data_get_length = libxpc.getExportByName("xpc_data_get_length");
var p_xpc_connection_send_message = libxpc.getExportByName("xpc_connection_send_message");
var p_xpc_connection_send_message_with_reply = libxpc.getExportByName("xpc_connection_send_message_with_reply");
var p_xpc_connection_send_message_with_reply_sync = libxpc.getExportByName("xpc_connection_send_message_with_reply_sync");
var p_xpc_connection_send_notification = libxpc.getExportByName("xpc_connection_send_notification");
var p__xpc_Connection_call_event_handler = DebugSymbol.fromName("_xpc_connection_call_event_handler").address;
var p___CFBinaryPlistCreate15 = DebugSymbol.fromName("__CFBinaryPlistCreate15").address;
var p_xpc_dictionary_get_count = libxpc.getExportByName("xpc_dictionary_get_count");
var xpcConnectionGetName = {
  name: "xpc_connection_get_name",
  ptr: p_xpc_connection_get_name,
  call: new NativeFunction(p_xpc_connection_get_name, "pointer", ["pointer"])
};
var xpcDictionaryApply = {
  name: "xpc_dictionary_apply",
  ptr: p_xpc_dictionary_apply,
  call: new NativeFunction(p_xpc_dictionary_apply, "pointer", ["pointer", "pointer"])
};
var xpcGetType = {
  name: "xpc_get_type",
  ptr: p_xpc_get_type,
  call: new NativeFunction(p_xpc_get_type, "pointer", ["pointer"])
};
var xpcDataGetBytesPtr = {
  name: "xpc_data_get_bytes_ptr",
  ptr: p_xpc_data_get_bytes_ptr,
  call: new NativeFunction(p_xpc_data_get_bytes_ptr, "pointer", ["pointer"])
};
var xpcDataGetLength = {
  name: "xpc_data_get_length",
  ptr: p_xpc_data_get_length,
  call: new NativeFunction(p_xpc_data_get_length, "uint32", ["pointer"])
};
var xpcConnectionSendMessage = {
  name: "xpc_connection_send_message",
  ptr: p_xpc_connection_send_message,
  call: new NativeFunction(p_xpc_connection_send_message, "void", ["pointer", "pointer"])
};
var xpcConnectionSendMessageWithReply = {
  name: "xpc_connection_send_message_with_reply",
  ptr: p_xpc_connection_send_message_with_reply,
  call: new NativeFunction(p_xpc_connection_send_message_with_reply, "void", ["pointer", "pointer", "pointer", "pointer"])
};
var xpcConnectionSendMessageWithReplySync = {
  name: "xpc_connection_send_message_with_reply_sync",
  ptr: p_xpc_connection_send_message_with_reply_sync,
  call: new NativeFunction(p_xpc_connection_send_message_with_reply_sync, "void", ["pointer", "pointer", "pointer", "pointer"])
};
var xpcConnectionSendNotification = {
  name: "xpc_connection_send_notification",
  ptr: p_xpc_connection_send_notification,
  call: new NativeFunction(p_xpc_connection_send_notification, "void", ["pointer", "pointer"])
};
var xpcConnectionCallEventHandler = {
  name: "_xpc_connection_call_event_handler",
  ptr: p__xpc_Connection_call_event_handler,
  call: new NativeFunction(p__xpc_Connection_call_event_handler, "void", ["pointer", "pointer"])
};
var xpcDictionaryGetCount = {
  name: "xpc_dictionary_get_count",
  ptr: p_xpc_dictionary_get_count,
  call: new NativeFunction(p_xpc_dictionary_get_count, "size_t", ["pointer"])
};
var __CFBinaryPlistCreate15 = {
  name: "__CFBinaryPlistCreate15",
  ptr: p___CFBinaryPlistCreate15,
  call: new NativeFunction(p___CFBinaryPlistCreate15, "pointer", ["pointer", "uint64", "pointer"])
};

// agent/src/lib/helpers.ts
function wildcardMatch(target, pattern) {
  pattern = pattern.replace("*", ".*");
  pattern = "^" + pattern;
  let exp = new RegExp(pattern);
  return exp.test(target);
}
function objcObjectDebugDesc(ptr2) {
  const objcObject = new frida_objc_bridge_default.Object(ptr2);
  if (objcObject.$className === "OS_xpc_dictionary") {
    const entries = xpcDictionaryGetCount.call(objcObject);
    if (entries > 0) {
      return debugDescriptionForXPCDictionary(objcObject, entries);
    }
  }
  return objcObject.toString();
}
function debugDescriptionForXPCDictionary(xpcDict, count) {
  let outString = "<OS_xpc_dictionary> { count = " + count + " ";
  outString += "contents = \n	";
  const block_impl = function(key, value) {
    const valueType = objcObjectDebugDesc(xpcGetType.call(value));
    let keyString = key.readCString();
    outString += '"' + keyString + '" => ';
    let objcValue = new frida_objc_bridge_default.Object(value);
    switch (valueType) {
      case "OS_xpc_dictionary":
        let entriesCount = xpcDictionaryGetCount.call(value);
        outString += debugDescriptionForXPCDictionary(objcValue, entriesCount);
        break;
      case "OS_xpc_data":
        const bytesPtr = xpcDataGetBytesPtr.call(value);
        const length = xpcDataGetLength.call(value);
        let hexString = hexStringForBytes(bytesPtr, length);
        outString += `<data> { length = ${length.valueOf()} bytes, contents = 
		${hexString}
		}
	`;
        break;
      default:
        outString += objcValue.toString() + "\n	";
        break;
    }
    return true;
  };
  const applierBlock = new frida_objc_bridge_default.Block({
    implementation: block_impl,
    retType: "bool",
    argTypes: ["pointer", "pointer"]
  });
  xpcDictionaryApply.call(xpcDict, applierBlock.handle);
  outString += "\n}";
  return outString;
}
function hexStringForBytes(bytesPtr, length) {
  const { NSMutableString } = frida_objc_bridge_default.classes;
  const { NSString } = frida_objc_bridge_default.classes;
  let lenghtInt = length.valueOf();
  let hexString = "";
  let formatString = "%02lx";
  for (let i = 0; i < lenghtInt; i++) {
    let byte = bytesPtr.add(i);
    let byteVal = byte.readU8();
    let hex = Buffer.from([byteVal]).toString("hex");
    hexString += hex;
  }
  return hexString;
}

// agent/src/lib/formatters.ts
function formatMessageDescription(messageDesc, parsingResult) {
  var s = messageDesc;
  for (let result of parsingResult) {
    s = s.replace(new RegExp(`(${result.key}.*
)`), `$1Parsed ${result.format} data for key '${result.key}': 
${result.data}
`);
  }
  return s;
}

// agent/src/consts.ts
var outgoingXPCMessagesFunctionPointer = [
  xpcConnectionSendMessage,
  xpcConnectionSendMessageWithReply,
  xpcConnectionSendMessageWithReplySync,
  xpcConnectionSendNotification
];

// agent/src/lib/parse_bplist15.ts
function sym(mod, name) {
  if (mod)
    return Process.getModuleByName(mod).getExportByName(name);
  return Module.getGlobalExportByName(name);
}
var CF = Process.getModuleByName("CoreFoundation");
CF.ensureInitialized();
var CFGetTypeID = new NativeFunction(sym("CoreFoundation", "CFGetTypeID"), "ulong", ["pointer"]);
var CFDictionaryGetTypeID = new NativeFunction(sym("CoreFoundation", "CFDictionaryGetTypeID"), "ulong", []);
var CFArrayGetTypeID = new NativeFunction(sym("CoreFoundation", "CFArrayGetTypeID"), "ulong", []);
var CFStringGetTypeID = new NativeFunction(sym("CoreFoundation", "CFStringGetTypeID"), "ulong", []);
var CFNumberGetTypeID = new NativeFunction(sym("CoreFoundation", "CFNumberGetTypeID"), "ulong", []);
var CFBooleanGetTypeID = new NativeFunction(sym("CoreFoundation", "CFBooleanGetTypeID"), "ulong", []);
var CFDateGetTypeID = new NativeFunction(sym("CoreFoundation", "CFDateGetTypeID"), "ulong", []);
var CFDataGetTypeID = new NativeFunction(sym("CoreFoundation", "CFDataGetTypeID"), "ulong", []);
var CFNullGetTypeID = new NativeFunction(sym("CoreFoundation", "CFNullGetTypeID"), "ulong", []);
var CFCopyDescription = new NativeFunction(sym("CoreFoundation", "CFCopyDescription"), "pointer", ["pointer"]);
var CFRelease = new NativeFunction(sym("CoreFoundation", "CFRelease"), "void", ["pointer"]);
var CFDictionaryApplyFunction = new NativeFunction(sym("CoreFoundation", "CFDictionaryApplyFunction"), "void", ["pointer", "pointer", "pointer"]);
var CFDictionaryGetCount = new NativeFunction(sym("CoreFoundation", "CFDictionaryGetCount"), "long", ["pointer"]);
var CFArrayGetCount = new NativeFunction(sym("CoreFoundation", "CFArrayGetCount"), "long", ["pointer"]);
var CFArrayGetValueAtIndex = new NativeFunction(sym("CoreFoundation", "CFArrayGetValueAtIndex"), "pointer", ["pointer", "long"]);
var CFBooleanGetValue = new NativeFunction(sym("CoreFoundation", "CFBooleanGetValue"), "bool", ["pointer"]);
var CFNumberGetValue = new NativeFunction(sym("CoreFoundation", "CFNumberGetValue"), "bool", ["pointer", "int", "pointer"]);
var CFDateGetAbsoluteTime = new NativeFunction(sym("CoreFoundation", "CFDateGetAbsoluteTime"), "double", ["pointer"]);
var CFDataGetLength = new NativeFunction(sym("CoreFoundation", "CFDataGetLength"), "long", ["pointer"]);
var CFDataGetBytePtr = new NativeFunction(sym("CoreFoundation", "CFDataGetBytePtr"), "pointer", ["pointer"]);
function cfTypeOf(obj) {
  const tid = Number(CFGetTypeID(obj));
  if (tid === Number(CFDictionaryGetTypeID()))
    return "CFDictionary";
  if (tid === Number(CFArrayGetTypeID()))
    return "CFArray";
  if (tid === Number(CFStringGetTypeID()))
    return "CFString";
  if (tid === Number(CFNumberGetTypeID()))
    return "CFNumber";
  if (tid === Number(CFBooleanGetTypeID()))
    return "CFBoolean";
  if (tid === Number(CFDateGetTypeID()))
    return "CFDate";
  if (tid === Number(CFDataGetTypeID()))
    return "CFData";
  if (tid === Number(CFNullGetTypeID()))
    return "CFNull";
  return "Unknown";
}
function cfStringToJs(s) {
  try {
    return new frida_objc_bridge_default.Object(s).toString();
  } catch {
  }
  try {
    const desc = CFCopyDescription(s);
    if (!desc.isNull()) {
      try {
        return new frida_objc_bridge_default.Object(desc).toString();
      } finally {
        CFRelease(desc);
      }
    }
  } catch {
  }
  return "<CFString>";
}
function cfNumberToJs(n) {
  const buf = Memory.alloc(8);
  const kCFNumberSInt64Type = 4;
  if (CFNumberGetValue(n, kCFNumberSInt64Type, buf)) {
    return buf.readS64().toString();
  }
  const kCFNumberFloat64Type = 6;
  if (CFNumberGetValue(n, kCFNumberFloat64Type, buf)) {
    return buf.readDouble().toString();
  }
  return "<CFNumber>";
}
function cfDateToJs(d) {
  const secs2001 = CFDateGetAbsoluteTime(d);
  return `CFDate(${secs2001}s since 2001-01-01)`;
}
var DEFAULT_OPTS = { maxHex: 256, tryBPlist: true, maxDepth: 16 };
function previewCFDataSmart(cfData) {
  const len = Number(CFDataGetLength(cfData));
  const p = CFDataGetBytePtr(cfData);
  if (len <= 0 || p.isNull())
    return `<CFData len=${len}>`;
  if (len >= 8) {
    const magic = p.readCString(8);
    if (magic && magic.startsWith("bplist15") && __CFBinaryPlistCreate15) {
      try {
        const plist = __CFBinaryPlistCreate15.call(p, len, ptr(0));
        if (!plist.isNull()) {
          const pretty = dumpCF(plist, 0, { maxHex: 256, tryBPlist: true, maxDepth: 8 });
          CFRelease(plist);
          return `<CFData len=${len} (bplist)> ${pretty}`;
        }
      } catch {
      }
    } else if (magic && magic.startsWith("bplist00")) {
      return `<CFData len=${len} (bplist)> ${parseBPlist00(cfData, len).data}`;
    }
  }
  const maxProbe = Math.min(len, 128);
  const ab = p.readByteArray(maxProbe);
  const u8 = new Uint8Array(ab);
  const looksPrintable = u8.every((b) => b === 0 || b >= 32 && b <= 126);
  if (looksPrintable) {
    try {
      const NSString = frida_objc_bridge_default.classes.NSString;
      const s = NSString.alloc().initWithBytes_length_encoding_(
        p,
        len,
        4
        /*UTF8*/
      ).toString();
      if (/^[vViIQLqBcfds@:#\?0-9]+$/.test(s.replace(/\0+$/, ""))) {
        return `<CFData len=${len} ascii="${s}" (ObjC type encoding?)>`;
      }
      return `<CFData len=${len} utf8="${s}">`;
    } catch {
    }
    try {
      const s0 = p.readCString();
      if (s0 && s0.length > 0)
        return `<CFData len=${len} cstr="${s0}">`;
    } catch {
    }
  }
  if (len === 16) {
    const bytes = p.readByteArray(16);
    const b = Buffer.from(new Uint8Array(bytes));
    const hex2 = b.toString("hex");
    const uuid = [
      hex2.slice(0, 8),
      hex2.slice(8, 12),
      hex2.slice(12, 16),
      hex2.slice(16, 20),
      hex2.slice(20)
    ].join("-");
    return `<CFData len=16 uuid=${uuid}>`;
  }
  if (len <= 8) {
    const hex2 = Buffer.from(u8).toString("hex");
    const ascii = Array.from(u8).map((b) => b >= 32 && b <= 126 ? String.fromCharCode(b) : ".").join("");
    return `<CFData len=${len} hex=${hex2} ascii="${ascii}">`;
  }
  const preview = Math.min(len, 256);
  const abFull = p.readByteArray(preview);
  const hex = Buffer.from(new Uint8Array(abFull)).toString("hex");
  const b64 = Buffer.from(new Uint8Array(abFull)).toString("base64");
  return `<CFData len=${len} hex[0..${preview}]=${hex} b64[0..${preview}]=${b64}>`;
}
function dumpCF(obj, depth = 0, options) {
  const opts = { ...DEFAULT_OPTS, ...options ?? {} };
  if (depth > opts.maxDepth)
    return "...<max depth>...";
  const indent = "  ".repeat(depth);
  const t = cfTypeOf(obj);
  switch (t) {
    case "CFDictionary": {
      let out = indent + "{\n";
      const applier = new frida_objc_bridge_default.Block({
        retType: "void",
        argTypes: ["pointer", "pointer", "pointer"],
        implementation: (k, v, _ctx) => {
          out += `${indent}  ${dumpCF(k, 0, opts)} : ${dumpCF(v, depth + 1, opts)}
`;
        }
      });
      CFDictionaryApplyFunction(obj, applier.handle, ptr(0));
      return out + indent + "}";
    }
    case "CFArray": {
      const n = Number(CFArrayGetCount(obj));
      let out = indent + "[\n";
      for (let i = 0; i < n; i++) {
        const elem = CFArrayGetValueAtIndex(obj, i);
        out += dumpCF(elem, depth + 1, opts) + "\n";
      }
      return out + indent + "]";
    }
    case "CFString":
      return indent + JSON.stringify(cfStringToJs(obj));
    // JSON 转义更安全
    case "CFNumber":
      return indent + cfNumberToJs(obj);
    case "CFBoolean":
      return indent + (CFBooleanGetValue(obj) ? "true" : "false");
    case "CFDate":
      return indent + cfDateToJs(obj);
    case "CFData":
      return indent + previewCFDataSmart(obj);
    case "CFNull":
      return indent + "null";
    default: {
      try {
        const d = CFCopyDescription(obj);
        if (!d.isNull()) {
          try {
            return indent + new frida_objc_bridge_default.Object(d).toString();
          } finally {
            CFRelease(d);
          }
        }
      } catch {
      }
      return indent + "<Unknown CFType>";
    }
  }
}

// agent/src/lib/parsers.ts
function parseBPListKeysRecursively(connection, xpcDict) {
  const objType = objcObjectDebugDesc(xpcGetType.call(xpcDict));
  if (objType != "OS_xpc_dictionary") {
    throw Error("Bad object type " + objType);
  }
  const parsingResult = [];
  const block_impl = function(key, value) {
    const valueType = objcObjectDebugDesc(xpcGetType.call(value));
    switch (valueType) {
      case "OS_xpc_dictionary":
        parsingResult.push(...parseBPListKeysRecursively(connection, value));
        break;
      case "OS_xpc_data":
        const length = xpcDataGetLength.call(value) | 0;
        if (!Number.isFinite(length) || length <= 0)
          break;
        const bytesPtr = xpcDataGetBytesPtr.call(value);
        if (bytesPtr.isNull())
          break;
        let magic = null;
        if (length >= 8) {
          try {
            magic = bytesPtr.readCString(8);
          } catch {
            magic = null;
          }
        }
        let result;
        try {
          if (isKnownBPListData(magic)) {
            console.log("\u662F\u5DF2\u77E5\u7684bplist\u683C\u5F0F:", magic, "\u5F00\u59CB\u89E3\u6790");
            result = parseKnownBPList(bytesPtr, length);
          } else {
            result = parseGenericBPList(connection, value);
            if (magic && magic.startsWith("bplist")) {
              result.format = magic;
            }
          }
        } catch {
          break;
        }
        try {
          result.key = key.readCString() ?? null;
        } catch {
          result.key = null;
        }
        parsingResult.push(result);
        break;
      // const bytesPtr = <NativePointer>xpcDataGetBytesPtr.call(value);
      // const format = bytesPtr.readCString(8);
      // if (format != null && !format.startsWith("bplist")) {
      //     break;
      // }
      // const length = xpcDataGetLength.call(value) as number;
      // let result: IParsingResult;
      // if (isKnownBPListData(format)) {
      //     result = parseKnownBPList(bytesPtr, length);
      // } else {
      //     result = parseGenericBPList(connection, xpcDict);
      //     result.format = format as SupportedBPListFormat;
      // }
      // result.key = key.readCString();
      // parsingResult.push(result);
      // break;
      default:
        break;
    }
    return true;
  };
  const applierBlock = new frida_objc_bridge_default.Block({
    implementation: block_impl,
    retType: "bool",
    argTypes: ["pointer", "pointer"]
  });
  xpcDictionaryApply.call(xpcDict, applierBlock.handle);
  return parsingResult;
}
function parseKnownBPList(bytesPtr, length) {
  if (bytesPtr.isNull() || !Number.isFinite(length) || length <= 0) {
    return { key: null, data: "<empty>", format: "bplist15" };
  }
  try {
    const data = frida_objc_bridge_default.classes.NSData.dataWithBytes_length_(bytesPtr, length);
    console.log("\u5C1D\u8BD5\u7528 NSPropertyListSerialization \u89E3\u6790...");
    const fmtPtr = Memory.alloc(8);
    fmtPtr.writeU64(0);
    const plistObj = frida_objc_bridge_default.classes.NSPropertyListSerialization.propertyListWithData_options_format_error_(data, 0, fmtPtr, ptr(0));
    console.log("\u89E3\u6790PropertyList\u6210\u529F\uFF1A", plistObj);
    if (plistObj) {
      console.log("\u6839\u7C7B\u578B\u4E3A Foundation \u7C7B:", plistObj.$className());
    }
  } catch (error) {
    console.log("\u7528 NSPropertyListSerialization \u89E3\u6790\u5931\u8D25\uFF0C\u5C1D\u8BD5\u5176\u4ED6\u65B9\u6CD5...", error);
  }
  try {
    console.log("\u5C1D\u8BD5\u7528 NSKeyedUnarchiver \u89E3\u6863...");
    const data = frida_objc_bridge_default.classes.NSData.dataWithBytes_length_(bytesPtr, length);
    const un = frida_objc_bridge_default.classes.NSKeyedUnarchiver.alloc()["initForReadingWithData:"](data);
    if (un.respondsToSelector_("setRequiresSecureCoding:"))
      un;
    let obj = un["decodeObjectForKey:"]("root") || un["decodeObjectForKey:"]("$top") || un["decodeObjectForKey:"](null);
    un["finishDecoding"]();
    un.release();
    console.log("\u89E3\u6863\u7ED3\u679C\uFF1A", obj);
    if (obj)
      return { key: null, data: objcObjectSafeDesc(obj), format: "bplist15" };
  } catch (error) {
    console.log("\u7528 NSKeyedUnarchiver \u89E3\u6863\u5931\u8D25\uFF0C\u5C1D\u8BD5\u5176\u4ED6\u65B9\u6CD5...", error);
  }
  try {
    const cf = __CFBinaryPlistCreate15.call(bytesPtr, length, ptr(0));
    if (cf.isNull())
      return { key: null, data: "<error>", format: "bplist15" };
    const s = dumpCF(cf, 0);
    console.log("\u5C1D\u8BD5\u7528 __CFBinaryPlistCreate15 \u89E3\u6790\uFF0C\u7ED3\u679C\uFF1A", s);
    if (!cf.isNull())
      return { key: null, data: cfSafeDesc(cf), format: "bplist15" };
  } catch (_) {
  }
  return { key: null, data: "<error>", format: "bplist15" };
}
function objcObjectSafeDesc(ptr2) {
  if (!ptr2 || ptr2.isNull())
    return "<null>";
  try {
    const obj = new frida_objc_bridge_default.Object(ptr2);
    return obj.toString();
  } catch {
    return cfSafeDesc(ptr2);
  }
}
var CFCopyDescription2 = new NativeFunction(Module.findGlobalExportByName("CFCopyDescription"), "pointer", ["pointer"]);
var CFRelease2 = new NativeFunction(Module.findGlobalExportByName("CFRelease"), "void", ["pointer"]);
function cfSafeDesc(ptr2) {
  try {
    const cfStr = CFCopyDescription2(ptr2);
    if (cfStr.isNull())
      return "<cf:null>";
    try {
      return new frida_objc_bridge_default.Object(cfStr).toString();
    } finally {
      CFRelease2(cfStr);
    }
  } catch {
    return "<cf:unprintable>";
  }
}
function parseGenericBPList(connection, message) {
  const decoder = frida_objc_bridge_default.classes.NSXPCDecoder.alloc().init();
  try {
    decoder["- set_connection:"](connection);
    decoder["- _startReadingFromXPCObject:"](message);
    return { format: null, data: decoder.debugDescription(), key: null };
  } catch (e) {
    return { format: null, data: `<decoder error: ${String(e)}>`, key: null };
  } finally {
    decoder.dealloc();
  }
}
function parseBPlist00(bytesPtr, length) {
  const data = frida_objc_bridge_default.classes.NSData.dataWithBytes_length_(bytesPtr, length);
  const format = Memory.alloc(8);
  format.writeU64(2863311530);
  const plist = frida_objc_bridge_default.classes.NSPropertyListSerialization.propertyListWithData_options_format_error_(data, 0, format, ptr(0));
  return {
    key: null,
    data: objcObjectDebugDesc(plist),
    format: "bplist00"
  };
}
function isKnownBPListData(magic) {
  return magic === "bplist00" || magic === "bplist15";
}

// agent/src/hooking.ts
function installHooks(filter, shouldParse) {
  const pointers = [];
  if (filter.type & FilterType.Outgoing) {
    pointers.push(...outgoingXPCMessagesFunctionPointer);
  }
  if (filter.type & FilterType.Incoming) {
    pointers.push(xpcConnectionCallEventHandler);
  }
  for (let pointer of pointers) {
    Interceptor.attach(pointer.ptr, {
      onEnter: function(args) {
        _onEnterHandler(pointer.name, args, filter.connectionNamePattern, shouldParse);
      }
    });
  }
  send({
    "type": "agent:hooks_installed"
  });
}
var _onEnterHandler = function(symbol, args, connectionNamePattern, shouldParse) {
  const p_connection = new NativePointer(args[0]);
  const connectionName = xpcConnectionGetName.call(p_connection).readCString();
  if (connectionNamePattern != "*" && connectionName && !wildcardMatch(connectionName, connectionNamePattern)) {
    return;
  }
  console.log(`
---Entry Hooked ${symbol} for connection "${connectionName}" ---`);
  const ts = Date.now();
  send({
    type: "agent:trace:symbol",
    message: { timestamp: ts, symbol }
  });
  let connectionDesc = objcObjectDebugDesc(p_connection);
  const p_message = new NativePointer(args[1]);
  let messageDesc = objcObjectDebugDesc(p_message);
  const messageType = objcObjectDebugDesc(xpcGetType.call(p_message));
  console.log("xpc \u7B2C\u4E8C\u4E2A\u53C2\u6570\u4E3A\uFF1A", p_message.toString(), " Type: ", messageType);
  if (shouldParse) {
    const messageType2 = objcObjectDebugDesc(xpcGetType.call(p_message));
    if (messageType2 == "OS_xpc_dictionary") {
      const parsingResult = parseBPListKeysRecursively(p_connection, p_message);
      if (parsingResult.length > 0) {
        messageDesc = formatMessageDescription(messageDesc, parsingResult);
      }
    }
  }
  send({
    type: "agent:trace:data",
    message: {
      timestamp: ts,
      data: { conn: connectionDesc, message: messageDesc }
    }
  });
};

// agent/src/index.ts
rpc.exports = {
  installHooks: (filter, shouldParse) => installHooks(filter, shouldParse)
};

✄
{
  "version": 3,
  "sources": ["frida-shim:node_modules/@frida/base64-js/index.js", "frida-shim:node_modules/@frida/ieee754/index.js", "frida-shim:node_modules/@frida/buffer/index.js", "agent/src/lib/types.ts", "node_modules/frida-objc-bridge/lib/api.js", "node_modules/frida-objc-bridge/lib/fastpaths.js", "node_modules/frida-objc-bridge/index.js", "agent/src/lib/systemFunctions.ts", "agent/src/lib/helpers.ts", "agent/src/lib/formatters.ts", "agent/src/consts.ts", "agent/src/lib/parse_bplist15.ts", "agent/src/lib/parsers.ts", "agent/src/hooking.ts", "agent/src/index.ts"],
  "mappings": "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",
  "names": ["m", "fill", "copy", "m", "compare", "read", "i", "write", "byteLength", "code", "sym", "FilterType", "api", "signature", "code", "pointerSize", "method", "sel", "toJSON", "toString", "handle", "superSpecifier", "equals", "methodHandle", "types", "protocol", "m", "ptr", "read", "write", "block", "signature", "selector", "key", "name", "implementation", "owner", "invocationOptions", "retType", "argTypes", "ptr", "hex", "ptr", "CFCopyDescription", "CFRelease", "messageType"]
}
