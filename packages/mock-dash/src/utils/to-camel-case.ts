export type ToCamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer REST}`
    ? `${P1}${Capitalize<ToCamelCase<`${P2}${REST}`>>}`
    : S

export function toCamelCase(s: string): string {
  // UPDATED: Added '0-9' to the regex to handle cases like 'data-1' -> 'data1'
  return s.replace(/-([a-z0-9])/g, (g) => g[1].toUpperCase())
}
