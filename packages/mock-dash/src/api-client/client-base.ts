import type { EndpointInput, InferInput } from '../endpoint/input'
import type { EmptyObjectIsNever } from '../utils/types'
import type { InterceptorCallback } from './interceptor'

export type EndpointArgs<
  I extends EndpointInput,
  AdditionalArgs extends Record<string, unknown> = Record<string, unknown>,
> = EmptyObjectIsNever<InferInput<I>> extends never
  ? [
      args?: InferInput<I> & {
        headers?: Record<string, string>
        signal?: AbortSignal
        transformRequest?: InterceptorCallback<RequestInit>
        transformResponse?: InterceptorCallback<Response>
        fetch?: (input: Request) => Response | Promise<Response>
      } & AdditionalArgs,
    ]
  : [
      args: InferInput<I> & {
        headers?: Record<string, string>
        signal?: AbortSignal
        transformRequest?: InterceptorCallback<RequestInit>
        transformResponse?: InterceptorCallback<Response>
        fetch?: (input: Request) => Response | Promise<Response>
      } & AdditionalArgs,
    ]

export type FetchOptions = Omit<RequestInit, 'body' | 'window' | 'method'>
export type CreateApiClientArgs<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  apiSchema: T
  baseURL: string
  transformRequest?: InterceptorCallback<FetchOptions>
  transformResponse?: InterceptorCallback<Response>
  fetch?: (input: Request) => Response | Promise<Response>
} & FetchOptions
