import type { Context } from 'hono'
import type { Endpoint } from '../endpoint/endpoint'
import type { InferInput, ParsedPathParameters } from '../endpoint/input'

export type EndpointInputContext<E extends Endpoint = Endpoint> =
  E extends Endpoint<infer _R, infer P, infer _M, infer I>
    ? {
        endpoint: Omit<E, 'getMock' | 'defineMock'>
        inputs: InferInput<I> & {
          param: ParsedPathParameters<P>
        }
        honoContext: Context
      }
    : never
