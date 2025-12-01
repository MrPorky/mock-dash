import { z } from 'zod'
import type { Endpoint } from '../endpoint/endpoint'
import {
  isBinaryStreamResponse,
  isJSONStreamResponse,
  isSSEResponse,
} from '../endpoint/stream-response'
import { buildEndpointPath } from '../utils/build-endpoint-path'
import {
  ApiError,
  type Errors,
  NetworkError,
  ValidationError,
} from '../utils/errors'
import { buildFormData, serializeQueryParams } from '../utils/request-utils'
import type {
  CreateApiClientArgs,
  EndpointArgs,
  FetchOptions,
} from './client-base'
import type { InterceptorContext, InterceptorManager } from './interceptor'

/**
 * @internal
 * Prepares the URL, options, and context for a fetch call.
 * This refactors the common logic from `callRestEndpoint`.
 */
export async function _prepareFetch<T extends Endpoint<any>>(
  pathParams: Record<string, string>,
  endpoint: T,
  inputData: EndpointArgs<any>[0],
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
): Promise<
  | {
      fullUrl: string
      response: Response
      error?: never
    }
  | {
      fullUrl: string
      response?: Response
      error: Errors
    }
> {
  const {
    headers: customHeaders,
    transformRequest: localTransformRequest,
    transformResponse: localTransformResponse,
    fetch: localFetch,
    form,
    json,
    query,
    ...restInputData
  } = inputData || {}

  let fullUrl = buildEndpointPath(
    endpoint.path,
    requestOptions.alias,
    requestOptions.baseURL,
  )

  // Replace path parameters
  for (const [key, value] of Object.entries(pathParams)) {
    fullUrl = fullUrl.replace(`:${key}`, String(value)) // Ensure value is a string
  }

  // Validate and apply defaults
  let queryParams = query
  let jsonBody = json
  let formBody = form

  if (endpoint.input) {
    if (endpoint.input.query) {
      const querySchema = z.object(endpoint.input.query)
      const result = querySchema.safeParse(queryParams || {})
      if (!result.success) {
        return {
          fullUrl,
          error: new ValidationError(
            'Invalid query parameters',
            result.error,
            'request',
            {
              url: fullUrl,
              method: endpoint.method.toUpperCase(),
            },
          ),
        }
      }
      queryParams = result.data
    }

    if (endpoint.input.json) {
      const result = endpoint.input.json.safeParse(jsonBody || {})
      if (!result.success) {
        return {
          fullUrl,
          error: new ValidationError(
            'Invalid JSON body',
            result.error,
            'request',
            {
              url: fullUrl,
              method: endpoint.method.toUpperCase(),
            },
          ),
        }
      }
      jsonBody = result.data
    }

    if (endpoint.input.form) {
      const formSchema = z.object(endpoint.input.form)
      const result = formSchema.safeParse(formBody || {})
      if (!result.success) {
        return {
          fullUrl,
          error: new ValidationError(
            'Invalid form body',
            result.error,
            'request',
            {
              url: fullUrl,
              method: endpoint.method.toUpperCase(),
            },
          ),
        }
      }
      formBody = result.data
    }
  }

  // Handle query parameters
  if (queryParams) {
    const queryString = serializeQueryParams(queryParams)
    if (queryString) {
      fullUrl += `?${queryString}`
    }
  }

  const headers = {
    // Set 'Content-Type': 'application/json' by default
    // It will be removed for FormData later if needed
    'Content-Type': 'application/json',
    Accept: '*/*',
    ...requestOptions.headers,
    ...customHeaders,
  } satisfies HeadersInit

  // For stream requests, we explicitly ask for stream-friendly formats
  if (isSSEResponse(endpoint.response)) {
    headers.Accept = 'text/event-stream'
  } else if (isJSONStreamResponse(endpoint.response)) {
    headers.Accept = 'application/x-ndjson'
  } else if (isBinaryStreamResponse(endpoint.response)) {
    headers.Accept = endpoint.response.contentType
  }

  let options: RequestInit = {
    ...requestOptions,
    ...restInputData,
    method: endpoint.method.toUpperCase(),
    headers,
  }

  // Handle request body
  if (endpoint.method !== 'get') {
    if (jsonBody) {
      options.body = JSON.stringify(jsonBody)
    } else if (formBody) {
      // Remove Content-Type to let browser set it for FormData
      delete (headers as Record<string, string>)['Content-Type']
      options.body = buildFormData(formBody)
    }
  }

  // Prepare the interceptor context
  const context: InterceptorContext = {
    method: endpoint.method,
    path: fullUrl,
  }

  // Apply local request interceptor if provided
  if (localTransformRequest) {
    options = await localTransformRequest(context, options)
  }

  // Apply global request interceptors
  options = await interceptors.request.runAll(context, options)

  let response: Response
  try {
    const fetchFn = localFetch || requestOptions.fetch || fetch
    response = await fetchFn(new Request(fullUrl, options))
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        fullUrl,
        error: new NetworkError(`Network request failed: ${error.message}`, {
          url: fullUrl,
          method: endpoint.method.toUpperCase(),
          cause: error,
        }),
      }
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        fullUrl,
        error: new NetworkError('Request timeout', {
          url: fullUrl,
          method: endpoint.method.toUpperCase(),
          timeout: true,
          cause: error,
        }),
      }
    }
    return {
      fullUrl,
      error: new NetworkError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          url: fullUrl,
          method: endpoint.method.toUpperCase(),
          cause: error instanceof Error ? error : undefined,
        },
      ),
    }
  }

  // Apply local response interceptor if provided
  if (localTransformResponse) {
    response = await localTransformResponse(context, response)
  }

  // Apply global response interceptors
  response = await interceptors.response.runAll(context, response)

  // Handle non-2xx responses
  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      try {
        const text = await response.text()
        errorBody = text ? { message: text } : { message: 'Unknown error' }
      } catch {
        errorBody = { message: 'Unknown error' }
      }
    }

    return {
      fullUrl,
      error: new ApiError(
        `API call failed with status ${response.status}`,
        response.status,
        {
          body: errorBody,
          url: fullUrl,
          method: endpoint.method.toUpperCase(),
        },
      ),
    }
  }

  return { fullUrl, response }
}
