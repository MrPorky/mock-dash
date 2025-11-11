export const isBinaryArrayBuffer = (
  data: unknown,
): data is Uint8Array<ArrayBuffer> =>
  data instanceof Uint8Array && data.buffer instanceof ArrayBuffer
