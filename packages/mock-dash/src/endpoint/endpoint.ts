import type { DeepStrict } from '../utils/types'
import type { EndpointInput, EndpointInputType, ParamFromPath } from './input'

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete'

export type EndpointConfig<
  R,
  I extends EndpointInput,
  P extends string,
  T extends ParamFromPath<P>,
> = {
  input?: I & {
    param?: DeepStrict<ParamFromPath<P>, T>
  }
  response: R
  options?: EndpointOptions
}

export type EndpointOptions = {
  prefix?: string
}

export abstract class Endpoint<
  R = unknown,
  P extends string = string,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput = EndpointInputType,
> {
  public readonly method: M
  public readonly path: P
  public readonly response: R
  public readonly input: I | undefined
  public readonly options: EndpointOptions | undefined

  constructor(
    method: M,
    path: P,
    response: R,
    input?: I,
    options?: EndpointOptions,
  ) {
    this.method = method
    this.path = path
    this.response = response
    this.input = input
    this.options = options
  }
}
