import type { BinaryReader, BinaryWriter } from ".";

export type BinaryObjectInstance = {
  serialize(): BinaryWriter;
}

export type BinaryObject<T extends any, ArgT extends any[] = []> = {
  prototype: T;
  deserialize(reader: BinaryReader, ...args: ArgT): T;
}
