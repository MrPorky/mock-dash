import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Endpoint } from '../endpoint/endpoint'
import { _prepareFetch } from './_prepare-fetch'

describe('_prepareFetch options', () => {
  const mockInterceptors = {
    request: { runAll: vi.fn(async (_ctx, opts) => opts) } as any,
    response: { runAll: vi.fn(async (_ctx, res) => res) } as any,
  }

  const mockEndpoint: Endpoint<any> = {
    method: 'get',
    path: '/test',
    response: z.void(),
  } as any

  it('should propagate standard fetch options to the Request object', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const controller = new AbortController()

    await _prepareFetch(
      {},
      mockEndpoint,
      {
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'include',
        keepalive: true,
      } as any,
      {
        baseURL: 'http://localhost',
        fetch: mockFetch,
      },
      mockInterceptors,
    )

    expect(mockFetch).toHaveBeenCalled()
    const request = mockFetch.mock.calls[0][0] as Request

    expect(request.signal).toBeDefined()
    expect(request.signal.aborted).toBe(false)
    controller.abort()
    expect(request.signal.aborted).toBe(true)

    expect(request.cache).toBe('no-store')
    expect(request.mode).toBe('cors')
    expect(request.credentials).toBe('include')
    expect(request.keepalive).toBe(true)
  })

  it('should pass extra options (restInputData) to interceptors', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const requestInterceptor = vi.fn(async (_ctx, opts) => opts)

    const interceptors = {
      request: { runAll: requestInterceptor } as any,
      response: { runAll: vi.fn(async (_ctx, res) => res) } as any,
    }

    await _prepareFetch(
      {},
      mockEndpoint,
      {
        customOption: 'custom-value',
        priority: 'high',
      } as any,
      {
        baseURL: 'http://localhost',
        fetch: mockFetch,
      },
      interceptors,
    )

    expect(requestInterceptor).toHaveBeenCalled()
    const options = requestInterceptor.mock.calls[0][1]
    expect(options).toHaveProperty('customOption', 'custom-value')
    expect(options).toHaveProperty('priority', 'high')
  })

  it('should merge requestOptions and inputData options, preferring inputData', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const requestInterceptor = vi.fn(async (_ctx, opts) => opts)

    const interceptors = {
      request: { runAll: requestInterceptor } as any,
      response: { runAll: vi.fn(async (_ctx, res) => res) } as any,
    }

    await _prepareFetch(
      {},
      mockEndpoint,
      {
        cache: 'no-cache', // Should override default
      } as any,
      {
        baseURL: 'http://localhost',
        fetch: mockFetch,
        cache: 'default',
        mode: 'cors',
      } as any,
      interceptors,
    )

    expect(requestInterceptor).toHaveBeenCalled()
    const options = requestInterceptor.mock.calls[0][1]
    expect(options.cache).toBe('no-cache')
    expect(options.mode).toBe('cors')
  })
})
