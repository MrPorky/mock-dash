import { Endpoint, type HttpMethod } from './endpoint'
import type { EndpointInput, EndpointInputType } from './input'
import type { StreamResponse } from './stream-response'

export class StreamEndpoint<
  P extends string = string,
  R extends StreamResponse = StreamResponse,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput = EndpointInputType,
> extends Endpoint<R, P, M, I> {}
