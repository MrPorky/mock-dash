import type z from 'zod'
import type { EndpointInput, EndpointInputType } from '../endpoint/input'
import { Endpoint, type HttpMethod } from './endpoint'

export class HttpEndpoint<
  P extends string = string,
  R extends z.ZodType = z.ZodType,
  M extends HttpMethod = HttpMethod,
  I extends EndpointInput = EndpointInputType,
> extends Endpoint<R, P, M, I> {}
