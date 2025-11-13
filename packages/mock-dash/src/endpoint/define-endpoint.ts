import z from 'zod'
import type { EndpointConfig, EndpointOptions } from './endpoint'
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
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): WebSocketEndpoint<P, R, 'get', I, O>
export function defineGet<
  I extends EndpointInput<'get'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends StreamResponse,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): StreamEndpoint<P, R, 'get', I, O>
export function defineGet<
  I extends EndpointInput<'get'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): HttpEndpoint<P, R, 'get', I, O>
export function defineGet<
  I extends EndpointInput<'get'>,
  R extends z.ZodType | StreamResponse | WebSocketResponse,
  P extends string,
  T extends ParamFromPath<P>,
  O extends EndpointOptions = EndpointOptions,
>(path: P, { input, response, options }: EndpointConfig<R, I, P, T, O>) {
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
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<StreamResponse, I, P, T, O>,
): StreamEndpoint<P, StreamResponse, 'delete', I>
export function defineDelete<
  I extends EndpointInput<'delete'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): HttpEndpoint<P, R, 'delete', I, O>
export function defineDelete<
  I extends EndpointInput<'delete'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType | StreamResponse,
  O extends EndpointOptions = EndpointOptions,
>(path: P, { input, response, options }: EndpointConfig<R, I, P, T, O>) {
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
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): StreamEndpoint<P, R, 'post', I, O>
export function definePost<
  I extends EndpointInput<'post'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): HttpEndpoint<P, R, 'post', I, O>
export function definePost<
  I extends EndpointInput<'post'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
  O extends EndpointOptions = EndpointOptions,
>(path: P, { input, response, options }: EndpointConfig<R, I, P, T, O>) {
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
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): StreamEndpoint<P, R, 'put', I, O>
export function definePut<
  I extends EndpointInput<'put'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): HttpEndpoint<P, R, 'put', I, O>
export function definePut<
  I extends EndpointInput<'put'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
  O extends EndpointOptions = EndpointOptions,
>(path: P, { input, response, options }: EndpointConfig<R, I, P, T, O>) {
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
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): StreamEndpoint<P, R, 'patch', I, O>
export function definePatch<
  I extends EndpointInput<'patch'>,
  P extends string,
  T extends ParamFromPath<P>,
  R extends z.ZodType,
  O extends EndpointOptions = EndpointOptions,
>(
  path: P,
  config: EndpointConfig<R, I, P, T, O>,
): HttpEndpoint<P, R, 'patch', I, O>
export function definePatch<
  I extends EndpointInput<'patch'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
  O extends EndpointOptions = EndpointOptions,
>(path: P, { input, response, options }: EndpointConfig<R, I, P, T, O>) {
  if (response instanceof StreamResponse) {
    return new StreamEndpoint('patch', path, response, input, options)
  } else if (response instanceof z.ZodType) {
    return new HttpEndpoint('patch', path, response, input, options)
  }

  throw new Error('Invalid response type')
}
