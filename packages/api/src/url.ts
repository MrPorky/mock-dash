/**
 * URL building utilities: alias resolution, param substitution, normalization.
 */

/**
 * Replace `{name}` placeholders with their alias values.
 */
export function resolveAliases(path: string, aliases: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = aliases[name];
    return value !== undefined ? value : `{${name}}`;
  });
}

/**
 * Replace `:name` path parameters with actual values.
 */
export function substituteParams(path: string, params: Record<string, string>): string {
  return path.replace(/:(\w+)/g, (original, name: string) => {
    const value = params[name];
    return value !== undefined ? value : original;
  });
}

/**
 * Collapse consecutive forward slashes into a single slash,
 * preserving `://` for protocols.
 */
export function normalizeSlashes(url: string): string {
  // Separate protocol prefix if present
  const protocolMatch = url.match(/^(\w+:\/\/)(.*)/);
  if (protocolMatch) {
    const protocol = protocolMatch[1];
    const rest = protocolMatch[2].replace(/\/\/+/g, "/");
    return protocol + rest;
  }
  return url.replace(/\/\/+/g, "/");
}

/**
 * Build a query string from a record, omitting undefined values.
 */
export function buildQueryString(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Build the full URL from base, path, optional aliases, params, and query.
 */
export function buildFullUrl(
  baseURL: string,
  path: string,
  aliases?: Record<string, string>,
  params?: Record<string, string>,
  query?: Record<string, string | undefined>,
): string {
  let resolved = path;

  if (aliases) {
    resolved = resolveAliases(resolved, aliases);
  }

  if (params) {
    resolved = substituteParams(resolved, params);
  }

  // Combine base and path
  const base = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const fullPath = resolved.startsWith("/") ? resolved : `/${resolved}`;
  let url = normalizeSlashes(`${base}${fullPath}`);

  if (query) {
    url += buildQueryString(query);
  }

  return url;
}
