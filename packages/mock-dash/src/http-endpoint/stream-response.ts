import type z from 'zod'
import { HttpEndpoint } from './http-endpoint'

export abstract class StreamResponse {}

export class SSEResponse<
  E extends Record<string, z.ZodType>,
> extends StreamResponse {
  constructor(public readonly events: E) {
    super()
  }
}
export class JSONStreamResponse<I extends z.ZodType> extends StreamResponse {
  constructor(public readonly itemSchema: I) {
    super()
  }
}

export class BinaryStreamResponse extends StreamResponse {
  constructor(
    public readonly contentType: string = 'application/octet-stream',
  ) {
    super()
  }
}

export function defineSSE<E extends Record<string, z.ZodType>>(
  events: E,
): SSEResponse<E> {
  return new SSEResponse(events)
}

export function defineJSONStream<I extends z.ZodType>(
  itemSchema: I,
): JSONStreamResponse<I> {
  return new JSONStreamResponse(itemSchema)
}

export function defineBinaryStream(
  contentType: string = 'application/octet-stream',
): BinaryStreamResponse {
  return new BinaryStreamResponse(contentType)
}

export function isHttpEndpointWithStreamResponse<T extends HttpEndpoint>(
  value: unknown,
): value is T extends HttpEndpoint<infer _P, infer _R, infer _M, infer _I>
  ? _R extends StreamResponse
    ? T
    : never
  : never {
  return (
    value instanceof HttpEndpoint && value.response instanceof StreamResponse
  )
}

export function isStreamResponse(value: unknown): value is StreamResponse {
  return value instanceof StreamResponse
}

export function isSSEResponse(value: unknown): value is SSEResponse<any> {
  return value instanceof SSEResponse
}

export function isJSONStreamResponse(
  value: unknown,
): value is JSONStreamResponse<any> {
  return value instanceof JSONStreamResponse
}

export function isBinaryStreamResponse(
  value: unknown,
): value is BinaryStreamResponse {
  return value instanceof BinaryStreamResponse
}
