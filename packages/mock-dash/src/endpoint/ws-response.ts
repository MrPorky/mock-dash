import type z from 'zod'

export class WebSocketResponse<
  S extends Array<z.ZodType> = Array<z.ZodType>,
  C extends Array<z.ZodType> = Array<z.ZodType>,
> {
  constructor(
    public readonly serverToClient: S,
    public readonly clientToServer: C,
  ) {}
}

export function defineWebSocket<
  S extends Array<z.ZodType>,
  C extends Array<z.ZodType>,
>(serverToClient: S, clientToServer: C): WebSocketResponse<S, C> {
  return new WebSocketResponse(serverToClient, clientToServer)
}

export function isWebSocketResponse(
  value: unknown,
): value is WebSocketResponse<any, any> {
  return value instanceof WebSocketResponse
}
