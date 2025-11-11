import type z from 'zod'
import type { EndpointInputContext } from '../create-mock-server/mock'
import type { EndpointInput, EndpointInputType } from '../endpoint/input'
import type { MockStructure } from '../utils/create-mock'
import { Endpoint, type HttpMethod } from './endpoint'

export function isHttpEndpoint(endpoint: Endpoint): endpoint is HttpEndpoint {
  return endpoint instanceof HttpEndpoint
}

type HttpMock<E extends Endpoint, R extends z.ZodType> = MockStructure<
  R,
  EndpointInputContext<E>
>

export class HttpEndpoint<
  P extends string = string,
  R extends z.ZodType = z.ZodType,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput<M> = EndpointInputType,
  Mock extends HttpMock<Endpoint<R, P, M, I>, R> = HttpMock<
    Endpoint<R, P, M, I>,
    R
  >,
> extends Endpoint<R, P, M, I, Mock> {
  #mock?: Mock

  defineMock(input: Mock): void {
    this.#mock = input
  }

  getMock(): Mock | undefined {
    return this.#mock
  }
}
