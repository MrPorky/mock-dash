import type z from 'zod'

export class WebSocketResponse<
  M extends Record<string, z.ZodType> = Record<string, z.ZodType>,
> {
  constructor(public readonly messages: M) {}
}

export function defineWebSocket<M extends Record<string, z.ZodType>>(
  messages: M,
): WebSocketResponse<M> {
  return new WebSocketResponse(messages)
}

export function isWebSocketResponse(
  value: unknown,
): value is WebSocketResponse<any> {
  return value instanceof WebSocketResponse
}
