import type { SendOptions, WSContext } from 'hono/ws'
import type z from 'zod'
import type { EndpointInputContext } from '../create-mock-server/mock'
import { Endpoint, type EndpointOptions, type HttpMethod } from './endpoint'
import type { EndpointInput, EndpointInputType } from './input'
import type { WebSocketResponse } from './ws-response'

export function isWebSocketEndpoint(
  endpoint: Endpoint,
): endpoint is WebSocketEndpoint {
  return endpoint instanceof WebSocketEndpoint
}

type WebsocketContext<T extends Array<z.ZodType>> = Omit<
  WSContext<z.infer<z.ZodUnion<T>>>,
  'send'
> & {
  send(source: z.infer<z.ZodUnion<T>>, options?: SendOptions): void
}

type WebsocketBody<R extends WebSocketResponse> = R extends WebSocketResponse<
  infer S,
  infer C
>
  ? {
      onOpen?: (evt: Event, ws: WebsocketContext<S>) => void
      onMessage?: (
        evt: MessageEvent<z.infer<z.ZodUnion<C>>>,
        ws: WebsocketContext<S>,
      ) => void
      onClose?: (evt: CloseEvent, ws: WebsocketContext<S>) => void
      onError?: (evt: Event, ws: WebsocketContext<S>) => void
    }
  : never

type WebSocketMock<E extends Endpoint, R extends WebSocketResponse> =
  | ((c: EndpointInputContext<E>) => WebsocketBody<R>)
  | WebsocketBody<R>

export class WebSocketEndpoint<
  P extends string = string,
  R extends WebSocketResponse = WebSocketResponse,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput<M> = EndpointInputType,
  O extends EndpointOptions = EndpointOptions,
  Mock extends WebSocketMock<Endpoint<R, P, M, I, O>, R> = WebSocketMock<
    Endpoint<R, P, M, I, O>,
    R
  >,
> extends Endpoint<R, P, M, I, O> {
  #mock?: Mock

  defineMock(input: Mock): void {
    this.#mock = input
  }

  getMock(): Mock | undefined {
    return this.#mock
  }
}
