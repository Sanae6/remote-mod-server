export class BinaryReaderStarvationError extends Error {
  constructor(requestedBytes: number) {
    super(`A request for ${requestedBytes} exceeded the size of the remaining data.`);
  }
}
