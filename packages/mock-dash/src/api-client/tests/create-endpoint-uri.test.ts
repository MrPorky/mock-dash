import { describe, expect, it } from 'vitest'
import { createApiClient } from '../api-client'

describe('createEndpointUri', () => {
  it('should create URI with single path parameter', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri('/users/:id', { id: '123' })
    expect(uri).toBe('https://api.example.com/users/123')
  })

  it('should create URI with multiple path parameters', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri(
      '/users/:userId/posts/:postId/comments/:commentId',
      { userId: '1', postId: '42', commentId: '789' },
    )
    expect(uri).toBe('https://api.example.com/users/1/posts/42/comments/789')
  })

  it('should create URI without path parameters', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri('/users')
    expect(uri).toBe('https://api.example.com/users')
  })

  it('should create URI with path aliases', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
      alias: { api: '/api/v1' },
    })

    const uri = client.createEndpointUri('/{api}/products/:id', { id: '456' })
    expect(uri).toBe('https://api.example.com/api/v1/products/456')
  })

  it('should create URI with multiple aliases', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
      alias: { api: '/api', version: '/v2' },
    })

    const uri = client.createEndpointUri('/{api}/{version}/resource/:id', {
      id: '999',
    })
    expect(uri).toBe('https://api.example.com/api/v2/resource/999')
  })

  it('should create URI without baseURL', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: '',
    })

    const uri = client.createEndpointUri('/users/:id', { id: '123' })
    expect(uri).toBe('/users/123')
  })

  it('should handle baseURL without protocol', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: '/api/v1',
    })

    const uri = client.createEndpointUri('/users/:id', { id: '123' })
    expect(uri).toBe('/api/v1/users/123')
  })

  it('should handle trailing slashes correctly', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com/',
    })

    const uri = client.createEndpointUri('/users/:id', { id: '123' })
    expect(uri).toBe('https://api.example.com/users/123')
  })

  it('should handle numeric parameter values', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri('/users/:id', { id: 123 as any })
    expect(uri).toBe('https://api.example.com/users/123')
  })

  it('should handle complex baseURL with path', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com/api/v1',
    })

    const uri = client.createEndpointUri('/users/:id', { id: '123' })
    expect(uri).toBe('https://api.example.com/api/v1/users/123')
  })

  it('should handle paths with dashes and underscores', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri('/user-profiles/:user_id/settings', {
      user_id: 'abc-123',
    })
    expect(uri).toBe('https://api.example.com/user-profiles/abc-123/settings')
  })

  it('should handle parameter values with special characters', () => {
    const client = createApiClient({
      apiSchema: {},
      baseURL: 'https://api.example.com',
    })

    const uri = client.createEndpointUri('/users/:email', {
      email: 'user@example.com',
    })
    expect(uri).toBe('https://api.example.com/users/user@example.com')
  })
})
