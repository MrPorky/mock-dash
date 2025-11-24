import type { DeepStrict } from '../utils/types'
import type { EndpointInput, EndpointInputType, ParamFromPath } from './input'

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete'

export type EndpointPath = '/' | `/${string}`

export type EndpointConfig<
  R,
  I extends EndpointInput,
  P extends EndpointPath,
  T extends ParamFromPath<P>,
  O extends EndpointOptions,
> = {
  input?: I & {
    param?: DeepStrict<ParamFromPath<P>, T>
  }
  response: R
  options?: O
}

export type EndpointOptions = Record<string, unknown>

export abstract class Endpoint<
  R = unknown,
  P extends string = string,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput = EndpointInputType,
  O extends EndpointOptions = EndpointOptions,
  Mock = unknown,
> {
  public readonly method: M
  public readonly path: P
  public readonly response: R
  public readonly input: I | undefined
  public readonly options: O | undefined

  constructor(method: M, path: P, response: R, input?: I, options?: O) {
    this.method = method
    this.path = path
    this.response = response
    this.input = input
    this.options = options
  }

  abstract defineMock(input: Mock): void
  abstract getMock(): Mock | undefined
}
