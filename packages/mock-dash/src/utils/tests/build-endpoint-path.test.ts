import { describe, expect, it } from 'vitest'
import { buildEndpointPath } from '../build-endpoint-path'

describe('buildEndpointPath', () => {
  it('returns raw path when no prefix provided', () => {
    expect(buildEndpointPath('/users', undefined)).toBe('/users')
  })

  it('applies simple prefix', () => {
    expect(buildEndpointPath('/users', '/api')).toBe('/api/users')
  })

  it('normalizes duplicate slashes in prefix', () => {
    expect(buildEndpointPath('users', '///api///v1//')).toBe('/api/v1/users')
  })

  it('handles root prefix as no-op', () => {
    expect(buildEndpointPath('users', '/')).toBe('/users')
  })

  it('works with dynamic params', () => {
    expect(buildEndpointPath('/users/:id', '/api/v1')).toBe('/api/v1/users/:id')
  })

  it('trims whitespace around prefix', () => {
    expect(buildEndpointPath('/ping', '  /api  ')).toBe('/api/ping')
  })

  it('accepts plain absolute path without method', () => {
    expect(buildEndpointPath('/users', '/api')).toBe('/api/users')
  })

  it('accepts plain relative path without method', () => {
    expect(buildEndpointPath('users', '/api')).toBe('/api/users')
  })

  it('plain path without prefix still normalized', () => {
    expect(buildEndpointPath('///users', undefined)).toBe('/users')
  })

  // basePath support
  it('combines basePath, prefix and path (full URL base)', () => {
    expect(buildEndpointPath('/users/', '/api/', 'https://my.api/')).toBe(
      'https://my.api/api/users',
    )
  })

  it('combines basePath path segment, prefix and path', () => {
    expect(buildEndpointPath('users', '/v1', '/root/')).toBe('/root/v1/users')
  })

  it('handles basePath without prefix', () => {
    expect(buildEndpointPath('/users', undefined, 'https://x.dev/')).toBe(
      'https://x.dev/users',
    )
  })

  it('handles basePath with trailing & path leading slashes', () => {
    expect(buildEndpointPath('///users', '/api', 'https://a.b///')).toBe(
      'https://a.b/api/users',
    )
  })
})
