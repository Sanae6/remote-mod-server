import { BinaryObjectInstance } from "./object";
import { BinaryReader } from "./reader";
import { BinaryWriter } from "./writer";

export class SizeComputer {
  constructor(
    protected size: number = 0,
  ) {}

  static boolean() { return new SizeComputer().boolean() }
  boolean() { this.size += 1; return this }

  static int8() { return new SizeComputer().int8() }
  int8() { this.size += 1; return this }

  static int16() { return new SizeComputer().int16() }
  int16() { this.size += 2; return this }

  static int24() { return new SizeComputer().int24() }
  int24() { this.size += 3; return this }

  static int32() { return new SizeComputer().int32() }
  int32() { this.size += 4; return this }

  static int48() { return new SizeComputer().int48() }
  int48() { this.size += 6; return this }

  static int64() { return new SizeComputer().int64() }
  int64() { this.size += 8; return this }

  static float32() { return new SizeComputer().float32() }
  float32() { this.size += 4; return this }

  static float64() { return new SizeComputer().float64() }
  float64() { this.size += 8; return this }

  static packedUInt32(v: number) { return new SizeComputer().packedUInt32(v) }
  packedUInt32(v: number) {
    do {
      this.size++;
      v >>>= 7;
    } while (v != 0);
    return this;
  }

  static packedSInt32(v: number) { return new SizeComputer().packedSInt32(v) }
  packedSInt32(v: number) { return this.packedUInt32(v >>> 0) }

  static bytes(bytes: Buffer | ArrayBuffer | Uint8Array | DataView | number[] | BinaryReader | BinaryWriter | number | SizeComputer) { return new SizeComputer().bytes(bytes) }
  bytes(bytes: Buffer | ArrayBuffer | Uint8Array | DataView | number[] | BinaryReader | BinaryWriter | number | SizeComputer) {
    if (typeof bytes === "number") {
      this.size += bytes;
      return this;
    }

    if (bytes instanceof SizeComputer) {
      this.size += bytes.getSize();
      return this;
    }

    if (Array.isArray(bytes)) {
      bytes = new Uint8Array(bytes);
    }

    if (bytes instanceof BinaryReader || bytes instanceof BinaryWriter) {
      bytes = bytes.getBuffer();
    }

    while (!(bytes instanceof ArrayBuffer)) {
      bytes = bytes.buffer;
    }

    this.size += bytes.byteLength;

    return this;
  }

  static string(string: string) { return new SizeComputer().string(string) }
  string(string: string) {
    return this.bytes(new TextEncoder().encode(string));
  }

  static array(arr: any[], size: SizeComputer | number) { return new SizeComputer().array(arr, size) }
  array(arr: any[], size: SizeComputer | number) {
    this.size += (typeof size === "number" ? size : size.getSize()) * arr.length;
    return this;
  }

  static getSize() { return 0 }
  getSize() {
    return this.size;
  }

  static conditional<T>(condition: T, size: (v: T & {}) => number | SizeComputer) { return new SizeComputer().conditional(condition, size); }
  conditional<T>(condition: T, size: (v: T & {}) => number | SizeComputer) {
    if (condition !== undefined && condition !== null) {
      const result = size(condition);

      this.size += typeof result === "number" ? result : result.getSize();
    }

    return this;
  }
}
