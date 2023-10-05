import { BinaryReaderStarvationError, BinaryObject, BinaryWriter } from "./";

export class BinaryReader {
  static from(buffer: Buffer | DataView | ArrayBuffer | BinaryWriter): BinaryReader {
    if (buffer instanceof ArrayBuffer)
      return new BinaryReader(buffer);

    if (buffer instanceof BinaryWriter)
      return this.from(buffer.getBuffer());

    return this.from(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }

  protected constructor(bufferIn: ArrayBuffer) {
    this.buffer = new DataView(bufferIn);
  }

  protected buffer: DataView;
  protected readHead: number = 0;

  private incrHead(value: number): number {
    if (!this.hasBytesLeftToRead(value - 1))
      throw new BinaryReaderStarvationError(value);

    const temp = this.readHead;
    this.readHead += value;
    return temp;
  }

  private incrHeadRange(value: number): [ number, number ] {
    if (!this.hasBytesLeftToRead(value - 1))
      throw new BinaryReaderStarvationError(value);

    const temp = this.readHead;
    this.readHead += value;
    return [temp, this.readHead];
  }

  getBuffer() {
    return this.buffer;
  }

  getRemainingBuffer() {
    return this.buffer.buffer.slice(this.readHead)
  }

  clone() {
    return BinaryReader.from(this.getRemainingBuffer());
  }

  hasBytesLeftToRead(plus: number = 0): boolean { return (this.readHead + plus) < this.buffer.byteLength }

  countRemainingBytes() { return this.buffer.byteLength - this.readHead }

  readBoolean(): boolean { return this.readUInt8() !== 0 }

  readSInt8(): number { return this.buffer.getInt8(this.incrHead(1)) }
  readUInt8(): number { return this.buffer.getUint8(this.incrHead(1)) }
  readSInt16LE(): number { return this.buffer.getInt16(this.incrHead(2), true) }
  readUInt16LE(): number { return this.buffer.getUint16(this.incrHead(2), true) }
  readSInt16BE(): number { return this.buffer.getInt16(this.incrHead(2), false) }
  readUInt16BE(): number { return this.buffer.getUint16(this.incrHead(2), false) }

  /**
   * WARNING: SLOW. No native call for reading UInt24s.
   */
  readUInt24BE(): number {
    return (this.readUInt8() << 16) | (this.readUInt8() << 8) | this.readUInt8();
  }

  /**
   * WARNING: SLOW. No native call for reading SInt24s.
   */
  readSInt24BE(): number {
    const val = this.readUInt24BE();
    const neg = val & 0x80_00_00;

    if (!neg)
      return val;

    return (0xFF_FF_FF - val + 1) * -1;
  }

  /**
   * WARNING: SLOW. No native call for reading UInt24s.
   */
  readUInt24LE(): number {
    return this.readUInt8() | (this.readUInt8() << 8) | (this.readUInt8() << 16);
  }

  /**
   * WARNING: SLOW. No native call for reading SInt24s.
   */
  readSInt24LE(): number {
    const val = this.readUInt24LE();
    const neg = val & 0x80_00_00;

    if (!neg)
      return val;

    return (0xFF_FF_FF - val + 1) * -1;
  }

  readSInt32LE(): number { return this.buffer.getInt32(this.incrHead(4), true) }
  readUInt32LE(): number { return this.buffer.getUint32(this.incrHead(4), true) }
  readSInt32BE(): number { return this.buffer.getInt32(this.incrHead(4), false) }
  readUInt32BE(): number { return this.buffer.getUint32(this.incrHead(4), false) }

  /**
   * WARNING: SLOW. No native call for reading UInt48s.
   */
  readUInt48BE(): number {
    return (this.readUInt24BE() * 0x1000000) + this.readUInt24BE();
  }

  /**
   * WARNING: SLOW. No native call for reading SInt48s.
   */
  readSInt48BE(): number {
    const val = this.readUInt48BE();
    const neg = val >= 0x800000_000000;

    if (!neg)
      return val;

    return (0xFFFFFF_FFFFFF - val + 1) * -1;
  }

  /**
   * WARNING: SLOW. No native call for reading UInt48s.
   */
  readUInt48LE(): number {
    let binary = this.readUInt8();
    binary |= this.readUInt8() << 8;
    binary |= this.readUInt8() << 16;
    binary |= this.readUInt8() << 24;
    binary >>>= 0;
    binary += this.readUInt8() * 0x100000000;
    binary += this.readUInt8() * 0x10000000000;
    return binary;
  }

  /**
   * WARNING: SLOW. No native call for reading SInt48s.
   */
  readSInt48LE(): number {
    const val = this.readUInt48LE();
    const neg = val >= 0x800000_000000;

    if (!neg)
      return val;

    return (0xFFFFFF_FFFFFF - val + 1) * -1;
  }

  readSInt64LE(): bigint { return this.buffer.getBigInt64(this.incrHead(8), true) }
  readUInt64LE(): bigint { return this.buffer.getBigUint64(this.incrHead(8), true) }
  readSInt64BE(): bigint { return this.buffer.getBigInt64(this.incrHead(8), false) }
  readUInt64BE(): bigint { return this.buffer.getBigUint64(this.incrHead(8), false) }

  readFloat32LE(): number { return this.buffer.getFloat32(this.incrHead(4), true) }
  readFloat32BE(): number { return this.buffer.getFloat32(this.incrHead(4), false) }
  readFloat64LE(): number { return this.buffer.getFloat64(this.incrHead(8), true) }
  readFloat64BE(): number { return this.buffer.getFloat64(this.incrHead(8), false) }

  readPackedSInt32(): number {
    let readMore = true;
    let shift = 0;
    let output = 0;

    while (readMore) {
      let next = this.readUInt8();

      if (next >= 0x80) {
        readMore = true;
        next ^= 0x80;
      } else {
        readMore = false;
      }

      output |= next << shift;
      shift += 7;
    }

    return output;
  }

  readPackedUInt32(): number { return this.readPackedSInt32() >>> 0 }

  readBytes(length: number) { return BinaryReader.from(this.buffer.buffer.slice(...this.incrHeadRange(length))) }

  readString(length: number): string {
    return new TextDecoder().decode(this.readBytes(length).getBuffer().buffer);
  }
  readCString(): string {
    const length = new Uint8Array(this.buffer.buffer.slice(this.readHead)).indexOf(0);
    return new TextDecoder().decode(this.readBytes(length + 1).getBuffer().buffer);
  }

  read<T extends BinaryObject<any, any> | ((reader: BinaryReader, ...args: any[]) => any)>(object: T, ...args: T extends BinaryObject<any, infer ArgT> ? ArgT : T extends (arg0: any, ...args: infer ArgT) => any ? ArgT : []): T extends BinaryObject<infer Type, any> ? Type : T extends (...args: any[]) => infer Type ? Type : never { return "deserialize" in object ? object.deserialize(this, ...(args as any)) : object(this, ...(args as any)) }

  *readRemaining<T extends BinaryObject<any, any> | ((reader: BinaryReader, ...args: any[]) => any)>(object: T, ...args: T extends BinaryObject<any, infer ArgT> ? ArgT : T extends (arg0: any, ...args: infer ArgT) => any ? ArgT : []): Generator<T extends BinaryObject<infer Type, any> ? Type : T extends (...args: any[]) => infer Type ? Type : never> {
    while (this.hasBytesLeftToRead()) {
      yield this.read(object, ...args);
    }
  }

  readArray<T extends BinaryObject<any, any> | ((reader: BinaryReader, ...args: any[]) => any)>(count: number, object: T, ...args: T extends BinaryObject<any, infer ArgT> ? ArgT : T extends (arg0: any, ...args: infer ArgT) => any ? ArgT : []): (T extends BinaryObject<infer Type, any> ? Type : T extends (...args: any[]) => infer Type ? Type : never)[] {
    let arr = new Array(count);

    for (let i = 0; i < count; i++) {
      arr[i] = this.read(object, ...args);
    }

    return arr;
  }
}
