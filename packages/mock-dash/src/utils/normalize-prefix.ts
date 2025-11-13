/**
 * Normalizes a URL prefix by ensuring it starts with a single slash and has no trailing slashes.
 * @param prefix The prefix to normalize
 * @returns The normalized prefix
 */
export function normalizePrefix(prefix: string): string {
  if (!prefix) return ''

  let p = prefix.trim()

  // Replace multiple slashes with single
  p = p.replace(/\/+/g, '/')

  if (!p.startsWith('/')) p = `/${p}`

  // remove trailing slash(es)
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)

  return p
}
