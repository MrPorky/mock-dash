import z from 'zod'
import type { EndpointConfig } from './endpoint'
import { HttpEndpoint } from './http-endpoint'
import type { EndpointInput, ParamFromPath } from './input'
import { StreamEndpoint } from './stream-endpoint'
import { StreamResponse } from './stream-response'
import { WebSocketEndpoint } from './ws-endpoint'
import { WebSocketResponse } from './ws-response'

export const defineGet = <
  I extends EndpointInput<'get'>,
  R extends z.ZodType | StreamResponse | WebSocketResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: EndpointConfig<R, I, P, T>,
) => {
  if (response instanceof WebSocketResponse) {
    return new WebSocketEndpoint('get', path, response, input, options)
  } else if (response instanceof StreamResponse) {
    return new StreamEndpoint('get', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('get', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export const defineDelete = <
  I extends EndpointInput<'delete'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: EndpointConfig<R, I, P, T>,
) => {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('delete', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('delete', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export const definePost = <
  I extends EndpointInput<'post'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: EndpointConfig<R, I, P, T>,
) => {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('post', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('post', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export const definePut = <
  I extends EndpointInput<'put'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: EndpointConfig<R, I, P, T>,
) => {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('put', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('put', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export const definePatch = <
  I extends EndpointInput<'patch'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: EndpointConfig<R, I, P, T>,
) => {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('patch', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('patch', path, response, input, options)
  }

  throw new Error('Invalid response type')
}
