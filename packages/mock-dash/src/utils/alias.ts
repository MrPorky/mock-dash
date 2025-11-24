import type { UnionToIntersection } from 'hono/utils/types'
import type { ExtractEndpoints } from '../api-client/common-types'
import type { EmptyObjectIsNever, Prettify, RemoveNever } from './types'

type PathAliasToObject<R extends string> = R extends `${string}{${infer Rest}`
  ? Rest extends `${infer ParamName}}${infer Tail}`
    ? { [K in ParamName]: string } & PathAliasToObject<Tail> // Use & to merge
    : { [K in Rest]: string }
  : object

export type AliasFromApiSchema<T extends Record<string, unknown>> = Prettify<
  UnionToIntersection<PathAliasToObject<ExtractEndpoints<T>[number]['path']>>
>

export type AliasOptionFromApiSchema<T extends Record<string, unknown>> =
  RemoveNever<{
    alias: EmptyObjectIsNever<AliasFromApiSchema<T>>
  }>
