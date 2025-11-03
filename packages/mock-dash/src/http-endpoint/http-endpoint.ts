import z from 'zod'
import type { DeepStrict } from '../utils/types'
import type { HttpEndpointInput, HttpInput, ParamFromPath } from './http-input'
import type { StreamResponse } from './stream-response'

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete'

export type HttpConfig<
  R extends z.ZodType | StreamResponse,
  I extends HttpEndpointInput,
  P extends string,
  T extends ParamFromPath<P>,
> = {
  input?: I & {
    param?: DeepStrict<ParamFromPath<P>, T>
  }
  response: R
  options?: HttpOptions
}

export type HttpOptions = {
  prefix?: string
}

export function isHttpEndpointWithZodResponse<T extends HttpEndpoint>(
  value: unknown,
): value is T extends HttpEndpoint<infer _P, infer _R, infer _M, infer _I>
  ? _R extends z.ZodType
    ? T
    : never
  : never {
  return value instanceof HttpEndpoint && value.response instanceof z.ZodType
}

export class HttpEndpoint<
  P extends string = string,
  R extends z.ZodType | StreamResponse = z.ZodType | StreamResponse,
  M extends HttpMethod = HttpMethod,
  I extends HttpEndpointInput = HttpInput,
> {
  public readonly method: M
  public readonly path: P
  public readonly response: R
  public readonly input: I | undefined
  public readonly options: HttpOptions | undefined

  constructor(
    method: M,
    path: P,
    response: R,
    input?: I,
    options?: HttpOptions,
  ) {
    this.method = method
    this.path = path
    this.response = response
    this.input = input
    this.options = options
  }

  defineMock() {}
}
