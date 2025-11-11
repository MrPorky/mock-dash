import z from 'zod'
import type { EndpointConfig } from './endpoint'
import { HttpEndpoint } from './http-endpoint'
import type { EndpointInput, ParamFromPath } from './input'
import { StreamEndpoint } from './stream-endpoint'
import { StreamResponse } from './stream-response'
import { WebSocketEndpoint } from './ws-endpoint'
import { WebSocketResponse } from './ws-response'

export function defineGet<
  I extends EndpointInput<'get'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends WebSocketResponse,
>(
  path: P,
  config: EndpointConfig<R, I, P, T>,
): WebSocketEndpoint<P, R, 'get', I>
export function defineGet<
  I extends EndpointInput<'get'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends StreamResponse,
>(path: P, config: EndpointConfig<R, I, P, T>): StreamEndpoint<P, R, 'get', I>
export function defineGet<
  I extends EndpointInput<'get'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
>(path: P, config: EndpointConfig<R, I, P, T>): HttpEndpoint<P, R, 'get', I>
export function defineGet<
  I extends EndpointInput<'get'>,
  R extends z.ZodType | StreamResponse | WebSocketResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(path: P, { input, response, options = {} }: EndpointConfig<R, I, P, T>) {
  if (response instanceof WebSocketResponse) {
    return new WebSocketEndpoint('get', path, response, input, options)
  } else if (response instanceof StreamResponse) {
    return new StreamEndpoint('get', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('get', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export function defineDelete<
  I extends EndpointInput<'delete'>,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  config: EndpointConfig<StreamResponse, I, P, T>,
): StreamEndpoint<P, StreamResponse, 'delete', I>
export function defineDelete<
  I extends EndpointInput<'delete'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
>(path: P, config: EndpointConfig<R, I, P, T>): HttpEndpoint<P, R, 'delete', I>
export function defineDelete<
  I extends EndpointInput<'delete'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType | StreamResponse,
>(path: P, { input, response, options = {} }: EndpointConfig<R, I, P, T>) {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('delete', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('delete', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export function definePost<
  I extends EndpointInput<'post'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends StreamResponse,
>(path: P, config: EndpointConfig<R, I, P, T>): StreamEndpoint<P, R, 'post', I>
export function definePost<
  I extends EndpointInput<'post'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
>(path: P, config: EndpointConfig<R, I, P, T>): HttpEndpoint<P, R, 'post', I>
export function definePost<
  I extends EndpointInput<'post'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(path: P, { input, response, options = {} }: EndpointConfig<R, I, P, T>) {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('post', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('post', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export function definePut<
  I extends EndpointInput<'put'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends StreamResponse,
>(path: P, config: EndpointConfig<R, I, P, T>): StreamEndpoint<P, R, 'put', I>
export function definePut<
  I extends EndpointInput<'put'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
>(path: P, config: EndpointConfig<R, I, P, T>): HttpEndpoint<P, R, 'put', I>
export function definePut<
  I extends EndpointInput<'put'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(path: P, { input, response, options = {} }: EndpointConfig<R, I, P, T>) {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('put', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('put', path, response, input, options)
  }

  throw new Error('Invalid response type')
}

export function definePatch<
  I extends EndpointInput<'patch'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends StreamResponse,
>(path: P, config: EndpointConfig<R, I, P, T>): StreamEndpoint<P, R, 'patch', I>
export function definePatch<
  I extends EndpointInput<'patch'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
>(path: P, config: EndpointConfig<R, I, P, T>): HttpEndpoint<P, R, 'patch', I>
export function definePatch<
  I extends EndpointInput<'patch'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(path: P, { input, response, options = {} }: EndpointConfig<R, I, P, T>) {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('patch', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('patch', path, response, input, options)
  }

  throw new Error('Invalid response type')
}
