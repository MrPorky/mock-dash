import type { Endpoint } from '../endpoint/endpoint'
import type { HttpEndpoint } from '../endpoint/http-endpoint'
import type { StreamEndpoint } from '../endpoint/stream-endpoint'
import type { WebSocketEndpoint } from '../endpoint/ws-endpoint'
import type { ToCamelCase } from '../utils/to-camel-case'
import type { Combine } from '../utils/types'
import type { ExtractEndpoints, GetNextSegments } from './common-types'
import type { HttpEndpointCallSignature } from './http-call'
import type { StreamEndpointCallSignature } from './stream-call'
import type { WebSocketEndpointCallSignature } from './ws-call'

type EndpointCall<T extends Endpoint> = T extends Endpoint<
  infer _R,
  infer _P,
  infer M,
  infer _I
>
  ? {
      [K in M]: T extends HttpEndpoint<
        infer _P,
        infer R,
        infer _M,
        infer I,
        any
      >
        ? HttpEndpointCallSignature<R, I>
        : T extends WebSocketEndpoint<infer _P, infer R, infer _M, infer I, any>
          ? { $ws: WebSocketEndpointCallSignature<R, I> }
          : T extends StreamEndpoint<infer _P, infer R, infer _M, infer I, any>
            ? { $stream: StreamEndpointCallSignature<R, I> }
            : 'not yet implemented or unknown endpoint type'
    }
  : 'error dose not inherit from Endpoint'

type ApiClientRecursiveNode<
  P extends string,
  E_Union extends Endpoint,
> = Combine<
  E_Union extends any
    ? E_Union['path'] extends (P extends '' ? '/' : P)
      ? EndpointCall<E_Union>
      : never
    : never
> &
  (string extends GetNextSegments<P, E_Union>
    ? Record<string, any>
    : {
        [S in GetNextSegments<P, E_Union> as S extends `:${infer PARAM}`
          ? ToCamelCase<PARAM>
          : S extends `{${infer ALIAS}}`
            ? ToCamelCase<ALIAS>
            : ToCamelCase<S>]: S extends `:${infer _PARAM}`
          ? (value: string) => ApiClientRecursiveNode<`${P}/${S}`, E_Union>
          : ApiClientRecursiveNode<`${P}/${S}`, E_Union>
      })

type ApiClientRecursive<T extends Endpoint[]> = ApiClientRecursiveNode<
  '',
  T[number]
>

export type Client<T extends Record<string, unknown>> = ApiClientRecursive<
  ExtractEndpoints<T>
>
