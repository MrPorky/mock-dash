type Strict<B, T extends B> = T & {
  [K in Exclude<keyof T, keyof B>]?: never
}

export type DeepStrict<B, T extends B> = Strict<
  B,
  {
    [K in keyof T]: K extends keyof B
      ? T[K] extends object
        ? B[K] extends object
          ? DeepStrict<B[K], T[K]>
          : T[K]
        : T[K]
      : T[K]
  } & B
>

type FilteredKeys<T> = {
  [K in keyof T]: T[K] extends never ? never : K
}[keyof T]

export type RemoveNever<T> = {
  [K in FilteredKeys<T>]: T[K]
}

export type EmptyObjectIsNever<T> = keyof T extends never ? never : T
export type EmptyObjectIs<T, R> = keyof T extends never ? R : T

export type Combine<
  T,
  K extends PropertyKey = T extends any ? keyof T : never,
> = {
  [P in K]: (
    T extends unknown
      ? P extends keyof T
        ? (x: T[P]) => void
        : never
      : never
  ) extends (x: infer I) => void
    ? I
    : never
} extends infer O
  ? { [Key in keyof O as O[Key] extends never ? never : Key]: O[Key] }
  : never

export type MaybePromise<T> = T | Promise<T>

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
