import { normalizePrefix } from './normalize-prefix'

/**
 * Builds the runtime path for an endpoint key applying an optional prefix.
 * @param path The path to build
 * @param prefix An optional prefix to apply
 * @param basePath An optional base path (can be full URL or path segment)
 * @returns A path that always begins with '/' and a Prefix
 */
export function buildEndpointPath(
  path: string,
  prefix?: string,
  basePath?: string,
) {
  let working = path.trim()
  working = working.replace(/^\/+/g, '')
  const rawPath = `/${working}`

  const p = prefix ? normalizePrefix(prefix) : ''
  const combined = p && p !== '/' ? p + rawPath : rawPath

  if (!basePath) return combined

  // Normalize and concatenate basePath (can be full URL or path segment)
  const trimmedBase = basePath.trim()
  // Separate protocol + host if present
  const match = trimmedBase.match(/^(https?:\/\/[^/]+)(.*)$/i)
  let origin: string | undefined
  let baseRemainder = trimmedBase
  if (match) {
    origin = match[1]
    baseRemainder = match[2]
  }
  baseRemainder = baseRemainder.replace(/\/+/g, '/').replace(/\/$/, '')
  if (baseRemainder && !baseRemainder.startsWith('/')) {
    baseRemainder = `/${baseRemainder}`
  }
  const pathPart = combined.replace(/^\/+/, '')
  const finalPath = `${baseRemainder || ''}/${pathPart}`.replace(/\/+/g, '/')
  const trimmed = finalPath !== '/' ? finalPath.replace(/\/$/, '') : finalPath
  return (origin ? origin : '') + trimmed
}
