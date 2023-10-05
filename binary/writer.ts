import { BinaryObjectInstance, BinaryReader } from ".";

export class BinaryWriter {
  static allocate(size: number): BinaryWriter {
    return new BinaryWriter(new ArrayBuffer(size));
  }

  protected constructor(bufferIn: ArrayBuffer, writeHead?: number) {
    this.buffer = new DataView(bufferIn);

    if (writeHead !== undefined)
      this.writeHead = writeHead;
  }

  protected buffer: DataView;
  protected writeHead: number = 0;

  private realloc(newSize: number) {
    if (newSize === this.buffer.byteLength) return;

    const oldBuffer = this.buffer;
    const newBuffer = this.buffer = new DataView(new ArrayBuffer(newSize));

    new Uint8Array(newBuffer.buffer).set(new Uint8Array(oldBuffer.buffer.slice(0, newSize)));
  }

  private truncate() {
    this.realloc(this.writeHead);
  }

  private incrHead(value: number): number {
    while (!this.hasBytesLeftToWrite(value - 1))
      this.realloc(value + this.buffer.byteLength > this.buffer.byteLength * 2 ? value + this.buffer.byteLength : this.buffer.byteLength * 2);

    const temp = this.writeHead;
    this.writeHead += value;
    return temp;
  }

  private hasBytesLeftToWrite(plus: number = 0): boolean { return (this.writeHead + plus) < this.buffer.byteLength }

  getBuffer() {
    this.truncate();

    return this.buffer;
  }

  getReader() {
    return BinaryReader.from(this);
  }

  writeBoolean(boolean: boolean) { this.writeUInt8(boolean ? 1 : 0) }

  writeSInt8(value: number) { let head = this.incrHead(1); this.buffer.setInt8(head, value) }
  writeUInt8(value: number) { let head = this.incrHead(1); this.buffer.setUint8(head, value) }
  writeSInt16LE(value: number) { let head = this.incrHead(2); this.buffer.setInt16(head, value, true) }
  writeUInt16LE(value: number) { let head = this.incrHead(2); this.buffer.setUint16(head, value, true) }
  writeSInt16BE(value: number) { let head = this.incrHead(2); this.buffer.setInt16(head, value, false) }
  writeUInt16BE(value: number) { let head = this.incrHead(2); this.buffer.setUint16(head, value, false) }

  writeSInt24LE(value: number) {
    if (value >= 0)
      return this.writeUInt24LE(value);

    return this.writeUInt24LE(0xFF_FF_FF - ((value * -1) - 1));
  }

  writeUInt24LE(value: number) {
    this.writeUInt8(value & 0xff);
    this.writeUInt8(~~(value / (2 ** 8)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 16)) & 0xff);
  }

  writeSInt24BE(value: number) {
    if (value >= 0)
      return this.writeUInt24BE(value);

    return this.writeUInt24BE(0xFF_FF_FF - ((value * -1) - 1));
  }

  writeUInt24BE(value: number) {
    this.writeUInt8(~~(value / (2 ** 16)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 8)) & 0xff);
    this.writeUInt8(value & 0xff);
  }

  writeSInt32LE(value: number) { let head = this.incrHead(4); this.buffer.setInt32(head, value, true) }
  writeUInt32LE(value: number) { let head = this.incrHead(4); this.buffer.setUint32(head, value, true) }
  writeSInt32BE(value: number) { let head = this.incrHead(4); this.buffer.setInt32(head, value, false) }
  writeUInt32BE(value: number) { let head = this.incrHead(4); this.buffer.setUint32(head, value, false) }

  writeSInt48LE(value: number) {
    if (value >= 0)
      return this.writeUInt48LE(value);

    return this.writeUInt48LE(0xFFFFFF_FFFFFF - ((value * -1) - 1));
  }

  writeUInt48LE(value: number) {
    this.writeUInt8(value & 0xff);
    this.writeUInt8(~~(value / (2 ** 8)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 16)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 24)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 32)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 40)) & 0xff);
  }

  writeSInt48BE(value: number) {
    if (value >= 0)
      return this.writeUInt48BE(value);

    return this.writeUInt48BE(0xFFFFFF_FFFFFF - ((value * -1) - 1));
  }


  writeUInt48BE(value: number) {
    this.writeUInt8(~~(value / (2 ** 40)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 32)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 24)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 16)) & 0xff);
    this.writeUInt8(~~(value / (2 ** 8)) & 0xff);
    this.writeUInt8(value & 0xff);
  }

  writeSInt64LE(value: bigint) { let head = this.incrHead(8); this.buffer.setBigInt64(head, value, true) }
  writeUInt64LE(value: bigint) { let head = this.incrHead(8); this.buffer.setBigUint64(head, value, true) }
  writeSInt64BE(value: bigint) { let head = this.incrHead(8); this.buffer.setBigInt64(head, value, false) }
  writeUInt64BE(value: bigint) { let head = this.incrHead(8); this.buffer.setBigUint64(head, value, false) }

  writeFloat32LE(value: number) { let head = this.incrHead(4); this.buffer.setFloat32(head, value, true) }
  writeFloat32BE(value: number) { let head = this.incrHead(4); this.buffer.setFloat32(head, value, false) }
  writeFloat64LE(value: number) { let head = this.incrHead(8); this.buffer.setFloat64(head, value, true) }
  writeFloat64BE(value: number) { let head = this.incrHead(8); this.buffer.setFloat64(head, value, false) }

  writePackedUInt32(value: number) {
    do {
      let b = value & 0xff;

      if (value >= 0x80) {
        b |= 0x80;
      }

      this.writeUInt8(b);

      value >>>= 7;
    } while (value != 0);
  }

  writePackedSInt32(value: number) {
    return this.writePackedUInt32(value >>> 0);
  }

  writeBytes(bytes: Buffer | ArrayBuffer | Uint8Array | DataView | number[] | BinaryReader | BinaryWriter) {
    if (Array.isArray(bytes)) {
      bytes = new Uint8Array(bytes);
    }

    if (bytes instanceof BinaryReader || bytes instanceof BinaryWriter) {
      bytes = bytes.getBuffer();
    }

    while (!(bytes instanceof ArrayBuffer)) {
      bytes = bytes.buffer;
    }

    // this is done here since `incrHead` can change `this.buffer`
    const writeOffset = this.incrHead(bytes.byteLength);

    new Uint8Array(this.buffer.buffer).set(new Uint8Array(bytes), writeOffset);
  }

  writeString(string: string) {
    this.writeBytes(new TextEncoder().encode(string));
  }

  write(instance: BinaryObjectInstance) {
    this.writeBytes(instance.serialize());
  }
}
