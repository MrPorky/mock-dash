import { describe, expect, it } from 'vitest'
import { buildEndpointPath } from '../build-endpoint-path'

describe('buildEndpointPath', () => {
  it('returns raw path when no alias provided', () => {
    expect(buildEndpointPath('/users', undefined)).toBe('/users')
  })

  it('replaces simple alias', () => {
    expect(buildEndpointPath('{api}/users', { api: '/api' })).toBe('/api/users')
  })

  it('normalizes duplicate slashes in alias value', () => {
    expect(buildEndpointPath('{api}/users', { api: '///api///v1//' })).toBe(
      '/api/v1/users',
    )
  })

  it('handles root alias as no-op', () => {
    expect(buildEndpointPath('{root}/users', { root: '/' })).toBe('/users')
  })

  it('works with dynamic params', () => {
    expect(buildEndpointPath('{api}/users/:id', { api: '/api/v1' })).toBe(
      '/api/v1/users/:id',
    )
  })

  it('trims whitespace around alias value', () => {
    expect(buildEndpointPath('{api}/ping', { api: '  /api  ' })).toBe(
      '/api/ping',
    )
  })

  it('accepts plain absolute path without alias', () => {
    expect(buildEndpointPath('/users', undefined)).toBe('/users')
  })

  it('accepts plain relative path without alias', () => {
    expect(buildEndpointPath('users', undefined)).toBe('/users')
  })

  it('plain path without alias still normalized', () => {
    expect(buildEndpointPath('///users', undefined)).toBe('/users')
  })

  it('supports multiple aliases in one path', () => {
    expect(
      buildEndpointPath('{service}/{version}/users', {
        service: 'api',
        version: 'v1',
      }),
    ).toBe('/api/v1/users')
  })

  it('leaves unmatched placeholders unchanged', () => {
    expect(buildEndpointPath('{service}/users', { api: '/api' })).toBe('/users')
  })

  // basePath support
  it('combines basePath, alias and path (full URL base)', () => {
    expect(
      buildEndpointPath('{api}/users/', { api: '/api/' }, 'https://my.api/'),
    ).toBe('https://my.api/api/users')
  })

  it('combines basePath path segment, alias and path', () => {
    expect(
      buildEndpointPath('{version}/users', { version: '/v1' }, '/root/'),
    ).toBe('/root/v1/users')
  })

  it('handles basePath without alias', () => {
    expect(buildEndpointPath('/users', undefined, 'https://x.dev/')).toBe(
      'https://x.dev/users',
    )
  })

  it('handles basePath with trailing & path leading slashes', () => {
    expect(
      buildEndpointPath('{api}///users', { api: '/api' }, 'https://a.b///'),
    ).toBe('https://a.b/api/users')
  })
})
