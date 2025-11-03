import type z from 'zod'
import type { HttpConfig } from './http-endpoint'
import { HttpEndpoint } from './http-endpoint'
import type { HttpEndpointInput, ParamFromPath } from './http-input'
import type { StreamResponse } from './stream-response'

export const defineGet = <
  I extends HttpEndpointInput<'get'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: HttpConfig<R, I, P, T>,
) => {
  return new HttpEndpoint('get', path, response, input, options)
}

export const defineDelete = <
  I extends HttpEndpointInput<'delete'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: HttpConfig<R, I, P, T>,
) => {
  return new HttpEndpoint('delete', path, response, input, options)
}

export const definePost = <
  I extends HttpEndpointInput<'post'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: HttpConfig<R, I, P, T>,
) => {
  return new HttpEndpoint('post', path, response, input, options)
}

export const definePut = <
  I extends HttpEndpointInput<'put'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: HttpConfig<R, I, P, T>,
) => {
  return new HttpEndpoint('put', path, response, input, options)
}

export const definePatch = <
  I extends HttpEndpointInput<'patch'>,
  R extends z.ZodType | StreamResponse,
  P extends string,
  T extends ParamFromPath<P>,
>(
  path: P,
  { input, response, options = {} }: HttpConfig<R, I, P, T>,
) => {
  return new HttpEndpoint('patch', path, response, input, options)
}
