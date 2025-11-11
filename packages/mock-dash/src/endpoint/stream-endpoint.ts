import type { StreamingApi } from 'hono/utils/stream'
import type z from 'zod'
import type { EndpointInputContext } from '../create-mock-server/mock'
import { Endpoint, type HttpMethod } from './endpoint'
import type { EndpointInput, EndpointInputType } from './input'
import {
  BinaryStreamResponse,
  JSONStreamResponse,
  SSEResponse,
  type StreamResponse,
} from './stream-response'

type SSEMessage<T = Record<string, z.ZodType>> = {
  [K in keyof T]: {
    data: z.infer<T[K]> | Promise<z.infer<T[K]>>
    event: K
    id?: string
    retry?: number
  }
}[keyof T]

export function isSSEEndpoint(
  endpoint: Endpoint,
): endpoint is StreamEndpoint<string, SSEResponse> {
  return (
    endpoint instanceof StreamEndpoint &&
    endpoint.response instanceof SSEResponse
  )
}

export function isJSONStreamEndpoint(
  endpoint: Endpoint,
): endpoint is StreamEndpoint<string, JSONStreamResponse> {
  return (
    endpoint instanceof StreamEndpoint &&
    endpoint.response instanceof JSONStreamResponse
  )
}

export function isBinaryStreamEndpoint(
  endpoint: Endpoint,
): endpoint is StreamEndpoint<string, BinaryStreamResponse> {
  return (
    endpoint instanceof StreamEndpoint &&
    endpoint.response instanceof BinaryStreamResponse
  )
}

export function isStreamEndpoint(
  endpoint: Endpoint,
): endpoint is StreamEndpoint<string, StreamResponse> {
  return endpoint instanceof StreamEndpoint
}

type StreamingApiCore = Omit<StreamingApi, 'write' | 'writeln'>
type JSONStreamApi<E extends z.ZodType> = StreamingApiCore & {
  write(input: z.infer<E>): Promise<JSONStreamApi<E>>
  writeln(input: z.infer<E>): Promise<JSONStreamApi<E>>
}

type SSEMock<E extends Endpoint, Ev extends Record<string, z.ZodType>> = (
  args: EndpointInputContext<E> & {
    stream: StreamingApiCore & {
      write: (msg: SSEMessage<Ev>) => Promise<void>
    }
  },
) => Promise<void>

type JSONStreamMock<E extends Endpoint, Ev extends z.ZodType> = (
  args: EndpointInputContext<E> & {
    stream: JSONStreamApi<Ev>
  },
) => Promise<void>

type StreamMockFallback<E extends Endpoint> = (
  args: EndpointInputContext<E> & {
    stream: StreamingApi
  },
) => Promise<void>

type StreamMock<E extends Endpoint> = E['response'] extends SSEResponse<
  infer Ev
>
  ? SSEMock<E, Ev>
  : E['response'] extends JSONStreamResponse<infer Ev>
    ? JSONStreamMock<E, Ev>
    : StreamMockFallback<E>

export class StreamEndpoint<
  P extends string = string,
  R extends StreamResponse = StreamResponse,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput<M> = EndpointInputType,
  Mock extends StreamMock<Endpoint<R, P, M, I>> = StreamMock<
    Endpoint<R, P, M, I>
  >,
> extends Endpoint<R, P, M, I> {
  #mock?: Mock

  defineMock(input: Mock): void {
    this.#mock = input
  }

  getMock(): Mock | undefined {
    return this.#mock
  }
}
