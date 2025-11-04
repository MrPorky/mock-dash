import { Endpoint, type HttpMethod } from './endpoint'
import type { EndpointInput, EndpointInputType } from './input'
import type { WebSocketResponse } from './ws-response'

export class WebSocketEndpoint<
  P extends string = string,
  R extends WebSocketResponse = WebSocketResponse,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput = EndpointInputType,
> extends Endpoint<R, P, M, I> {}
