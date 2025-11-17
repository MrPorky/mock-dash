import type { Endpoint } from '../endpoint/endpoint'

export type GetNextSegments<
  P extends string,
  E_Union extends Endpoint,
> = E_Union extends any
  ? E_Union['path'] extends `${P}/${infer SEGMENT}`
    ? SEGMENT extends `${infer FIRST_PART}/${string}`
      ? FIRST_PART
      : SEGMENT
    : never
  : never

export type ExtractEndpoints<T> = {
  [K in keyof T]: T[K] extends Endpoint ? T[K] : never
}[keyof T][]
