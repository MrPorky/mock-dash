import type z from 'zod'
import type { HttpEndpoint } from '../http-endpoint/http-endpoint'
import type { HttpInput } from '../http-endpoint/http-input'
import type { Errors } from '../utils/errors'
import { ApiError, ValidationError } from '../utils/errors'
import { _prepareFetch } from './_prepare-fetch'
import type {
  CreateApiClientArgs,
  EndpointArgs,
  FetchOptions,
} from './client-base'
import type { InterceptorManager } from './interceptor'
import type { StreamEndpointCallSignature } from './sse-call'

type HttpEndpointCallSignature<R extends z.ZodType, I extends HttpInput> = (
  ...args: EndpointArgs<I>
) => Promise<
  | { data: z.infer<R>; response: Response; error?: never }
  | { data?: never; error: Errors; response?: Response }
>

export type HttpEndpointCall<T extends HttpEndpoint> = T extends HttpEndpoint<
  infer _P,
  infer R,
  infer M,
  infer I
>
  ? {
      [K in M]: R extends z.ZodType
        ? HttpEndpointCallSignature<R, I>
        : { $stream: StreamEndpointCallSignature<R, I> }
    }
  : never

export function callHttpEndpoint<
  R extends z.ZodType,
  T extends HttpEndpoint<string, R>,
>(
  pathParams: Record<string, string>,
  endpoint: T,
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
): HttpEndpointCallSignature<R, any> {
  return async (inputData) => {
    const { fullUrl, response, error } = await _prepareFetch(
      pathParams,
      endpoint,
      inputData,
      requestOptions,
      interceptors,
    )

    if (error) {
      return {
        error: error,
      }
    }

    let jsonResponse: unknown
    try {
      // Handle different response types based on the schema
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('text/')) {
        jsonResponse = await response.text()
      } else if (response.status === 204) {
        // No content response
        jsonResponse = undefined
      } else {
        jsonResponse = await response.json()
      }
    } catch (error) {
      return {
        error: new ApiError(
          'Failed to parse response as JSON',
          response.status,
          {
            url: fullUrl,
            method: endpoint.method.toUpperCase(),
            cause: error instanceof Error ? error : undefined,
          },
        ),
        response,
      }
    }

    // Validate response against schema
    const validationResult = endpoint.response.safeParse(jsonResponse)
    if (!validationResult.success) {
      return {
        error: new ValidationError(
          'Response validation failed',
          validationResult.error,
          'response',
          {
            status: response.status,
            body: jsonResponse,
            url: fullUrl,
            method: endpoint.method.toUpperCase(),
          },
        ),
        response,
      }
    }

    return {
      data: validationResult.data,
      response,
    }
  }
}
