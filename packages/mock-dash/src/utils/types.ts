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

export type Combine<T, K extends keyof T = keyof T> = {
  [P in K]: (T extends unknown ? (x: T[P]) => void : never) extends (
    x: infer I,
  ) => void
    ? I
    : never
} extends infer O
  ? { [K in keyof O as O[K] extends never ? never : K]: O[K] }
  : never
