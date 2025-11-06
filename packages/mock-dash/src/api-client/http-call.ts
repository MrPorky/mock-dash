import type z from 'zod'
import type { HttpEndpoint } from '../endpoint/http-endpoint'
import type { EndpointInputType } from '../endpoint/input'
import type { Errors } from '../utils/errors'
import { ApiError, ValidationError } from '../utils/errors'
import { _prepareFetch } from './_prepare-fetch'
import type {
  CreateApiClientArgs,
  EndpointArgs,
  FetchOptions,
} from './client-base'
import type { InterceptorManager } from './interceptor'

export type HttpEndpointCallSignature<
  R extends z.ZodType,
  I extends EndpointInputType,
> = (
  ...args: EndpointArgs<I>
) => Promise<
  | { data: z.infer<R>; response: Response; error?: never }
  | { data?: never; error: Errors; response?: Response }
>

export function callHttpEndpoint(
  pathParams: Record<string, string>,
  endpoint: HttpEndpoint,
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
): HttpEndpointCallSignature<z.ZodType, any> {
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
