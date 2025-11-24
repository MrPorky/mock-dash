import type z from 'zod'
import type { Prettify, RemoveNever } from '../utils/types'
import type { HttpMethod } from './endpoint'

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
> = R extends `${string}:${infer Rest}`
  ? Rest extends `${infer ParamName}/${infer Tail}`
    ? { [K in ParamName]: V } & PathParamToObject<V, Tail>
    : { [K in Rest]: V }
  : object

export type ParamFromPath<P extends string> = Prettify<
  Partial<PathParamToObject<OptionalStringValues, P>>
>

export type ParsedPathParameters<P extends string> = Prettify<
  PathParamToObject<string, P>
>

type Query = Record<string, z.ZodType>
type Json = z.ZodObject
type Form = Record<string, ZodFormValue | z.ZodArray<ZodFormValue>>

type EndpointInputSlim = {
  query?: Query
}

export type EndpointInput<METHOD extends HttpMethod = HttpMethod> =
  METHOD extends 'get' | 'delete'
    ? EndpointInputSlim
    : EndpointInputSlim & {
        json?: Json
        form?: Form
      }

export type EndpointInputType = {
  query?: Query
  json?: Json
  form?: Form
}

export type InferInput<I extends EndpointInputType = EndpointInputType> =
  RemoveNever<{
    query: I['query'] extends object ? z.infer<z.ZodObject<I['query']>> : never
    json: I['json'] extends z.ZodType ? z.infer<I['json']> : never
    form: I['form'] extends object ? z.infer<z.ZodObject<I['form']>> : never
  }>
