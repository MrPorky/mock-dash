import z from 'zod'
import {
  defineDelete,
  defineGet,
  definePatch,
  definePost,
  definePut,
} from '../endpoint/define-endpoint'
import type { Endpoint } from '../endpoint/endpoint'
import type { HttpEndpoint } from '../endpoint/http-endpoint'
import type { StreamEndpoint } from '../endpoint/stream-endpoint'
import { defineJSONStream, defineSSE } from '../endpoint/stream-response'
import type { WebSocketEndpoint } from '../endpoint/ws-endpoint'
import { defineWebSocket } from '../endpoint/ws-response'
import type { Combine } from '../utils/types'
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

type GetNextSegments<
  P extends string,
  E_Union extends Endpoint,
> = E_Union extends any
  ? E_Union['path'] extends `${P}/${infer SEGMENT}`
    ? SEGMENT extends `${infer FIRST_PART}/${string}`
      ? FIRST_PART
      : SEGMENT
    : never
  : never

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
          ? PARAM
          : S]: S extends `:${infer _PARAM}`
          ? (value: string) => ApiClientRecursiveNode<`${P}/${S}`, E_Union>
          : ApiClientRecursiveNode<`${P}/${S}`, E_Union>
      })

type ApiClientRecursive<T extends Endpoint[]> = ApiClientRecursiveNode<
  '',
  T[number]
>

type ExtractEndpoints<T> = {
  [K in keyof T]: T[K] extends Endpoint ? T[K] : never
}[keyof T][]

export type Client<T extends Record<string, unknown>> = ApiClientRecursive<
  ExtractEndpoints<T>
>
