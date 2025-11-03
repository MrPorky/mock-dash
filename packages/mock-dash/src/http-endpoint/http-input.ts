import type z from 'zod'
import type { RemoveNever } from '../utils/types'
import type { HttpMethod } from './http-endpoint'

type ZodStringValues =
  | z.ZodCoercedBigInt
  | z.ZodCoercedBoolean
  | z.ZodCoercedDate
  | z.ZodCoercedNumber
  | z.ZodStringFormat
  | z.ZodString

// type ZodStringValues = z.ZodStringFormat | z.ZodString

type OptionalStringValues = ZodStringValues | z.ZodOptional<ZodStringValues>

type ZodFormValue =
  | (ZodStringValues | z.ZodFile)
  | z.ZodOptional<ZodStringValues | z.ZodFile>

type PathParamToObject<
  V,
  R extends string,
  K extends string = never,
> = R extends `${string}:${infer P}`
  ? P extends `${infer PARAM}/${infer TR}`
    ? PathParamToObject<V, TR, K | PARAM>
    : { [Key in K | P]: V }
  : never

export type ParamFromPath<P extends string> = Partial<
  PathParamToObject<OptionalStringValues, P>
>

type Query = Record<string, z.ZodType>
type Json = z.ZodObject | z.ZodRecord
type Form = Record<string, ZodFormValue | z.ZodArray<ZodFormValue>>

type EndpointInputSlim = {
  query?: Query
}

export type HttpEndpointInput<METHOD extends HttpMethod = HttpMethod> =
  METHOD extends 'get' | 'delete'
    ? EndpointInputSlim
    : EndpointInputSlim & {
        json?: Json
        form?: Form
      }

export type HttpInput = {
  query?: Query
  json?: Json
  form?: Form
}

export type InferInput<I extends HttpInput = HttpInput> = RemoveNever<{
  query: I['query'] extends object ? z.infer<z.ZodObject<I['query']>> : never
  json: I['json'] extends z.ZodType ? z.infer<I['json']> : never
  form: I['form'] extends object ? z.infer<z.ZodObject<I['form']>> : never
}>
