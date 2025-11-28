import type z from 'zod'
import type { $ZodErrorTree } from 'zod/v4/core'
import type { Endpoint } from '../endpoint/endpoint'
import type { HttpEndpoint } from '../endpoint/http-endpoint'
import type { ParsedPathParameters } from '../endpoint/input'
import type { StreamEndpoint } from '../endpoint/stream-endpoint'
import type {
  BinaryStreamResponse,
  JSONStreamResponse,
  SSEResponse,
} from '../endpoint/stream-response'
import type { WebSocketEndpoint } from '../endpoint/ws-endpoint'
import type { ToCamelCase } from '../utils/to-camel-case'
import type { Combine } from '../utils/types'
import type { ExtractEndpoints, GetNextSegments } from './common-types'

type InferObjects<T extends Endpoint> = T extends Endpoint<
  infer _R,
  infer P,
  infer M,
  infer I
>
  ? {
      [K in M]: {
        json: I extends { json: any } ? z.infer<I['json']> : undefined
        query: I extends { query: any }
          ? z.infer<z.ZodObject<I['query']>>
          : undefined
        form: I extends { form: any } ? z.infer<I['form']> : undefined
        params: ParsedPathParameters<P>
      } & (T extends HttpEndpoint<infer _P, infer R, infer _M, infer _I, any>
        ? {
            response: z.infer<R>
            parseError: I extends { json: any }
              ? $ZodErrorTree<z.infer<I['json']>>
              : undefined
          }
        : T extends WebSocketEndpoint<
              infer _P,
              infer R,
              infer _M,
              infer _I,
              any
            >
          ? {
              $ws: {
                clientToServer: z.infer<z.ZodUnion<R['clientToServer']>>
                serverToClient: z.infer<z.ZodUnion<R['serverToClient']>>
              }
            }
          : T extends StreamEndpoint<infer _P, infer R, infer _M, infer _I, any>
            ? {
                $stream: {
                  response: R extends SSEResponse
                    ? z.infer<z.ZodObject<R['events']>>
                    : R extends JSONStreamResponse
                      ? z.infer<R['itemSchema']>
                      : R extends BinaryStreamResponse
                        ? Uint8Array
                        : 'unknown response type'
                }
              }
            : 'not yet implemented or unknown endpoint type')
    }
  : 'error dose not inherit from Endpoint'

type ApiClientRecursiveNode<
  P extends string,
  E_Union extends Endpoint,
> = Combine<
  E_Union extends any
    ? E_Union['path'] extends (P extends '' ? '/' : P)
      ? InferObjects<E_Union>
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
            : ToCamelCase<S>]: ApiClientRecursiveNode<`${P}/${S}`, E_Union>
      })

type ApiClientRecursive<T extends Endpoint[]> = ApiClientRecursiveNode<
  '',
  T[number]
>

export type InferClient<T extends Record<string, unknown>> = ApiClientRecursive<
  ExtractEndpoints<T>
>
