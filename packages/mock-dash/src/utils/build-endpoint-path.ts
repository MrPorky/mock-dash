import { normalizePrefix } from './normalize-prefix'

/**
 * Builds the runtime path for an endpoint applying optional alias replacements.
 * @param path The path to build (may contain {aliasKey} placeholders)
 * @param alias An optional record of alias replacements
 * @param basePath An optional base path (can be full URL or path segment)
 * @returns A path that always begins with '/' with aliases replaced
 */
export function buildEndpointPath(
  path: string,
  alias?: Record<string, string>,
  basePath?: string,
) {
  let working = path.trim()
  working = working.replace(/^\/+/g, '')
  let rawPath = `/${working}`

  // Replace aliases in the path
  if (alias) {
    for (const [key, value] of Object.entries(alias)) {
      const placeholder = `{${key}}`
      if (rawPath.includes(placeholder)) {
        const normalized = normalizePrefix(value)
        rawPath = rawPath.replace(placeholder, normalized)
      }
    }
  }

  // Clean up any double slashes that might have been introduced
  rawPath = rawPath.replace(/\/+/g, '/')

  if (!basePath) return rawPath

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
  const pathPart = rawPath.replace(/^\/+/, '')
  const finalPath = `${baseRemainder || ''}/${pathPart}`.replace(/\/+/g, '/')
  const trimmed = finalPath !== '/' ? finalPath.replace(/\/$/, '') : finalPath
  return (origin ? origin : '') + trimmed
}
