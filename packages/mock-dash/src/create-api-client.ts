import type { ValidationTargets } from 'hono'
import z from 'zod'
import type {
  ApiSchemaEndpoints,
  Args,
  Client,
  ClientFn,
  ClientProperties,
  FetchOptions,
  InterceptorCallback,
  InterceptorContext,
} from './client-types'
import { InterceptorManager } from './client-types'
import { httpMethodSchema } from './common-types'
import type { IEndpoint } from './endpoints'
import { buildEndpointPath, isEndpoint, isEndpoints } from './endpoints'
import { ApiError, NetworkError, ValidationError } from './errors'
import { buildFormData, serializeQueryParams } from './request-utils'

/**
 * Creates a type-safe API client from an API schema with automatic request/response validation,
 * interceptor support, and comprehensive error handling. The client provides full TypeScript
 * type inference and compile-time safety for all API interactions.
 *
 * @template T - The API schema type extending ApiSchema
 *
 * @param args - Configuration object for the API client
 * @param args.apiSchema - The API schema defining endpoints, validation, and response types
 * @param args.baseURL - Base URL for all API requests (e.g., 'https://api.example.com')
 * @param args.transformRequest - Legacy request interceptor function (use client.interceptors.request for new code)
 * @param args.transformResponse - Legacy response interceptor function (use client.interceptors.response for new code)
 * @param args.headers - Default headers to include with all requests
 * @param args.credentials - Fetch credentials option ('same-origin', 'include', 'omit')
 * @param args.signal - AbortSignal for request cancellation
 * @param args.cache - Fetch cache option
 * @param args.redirect - Fetch redirect option
 * @param args.referrer - Fetch referrer option
 * @param args.referrerPolicy - Fetch referrer policy option
 * @param args.integrity - Fetch integrity option
 * @param args.keepalive - Fetch keepalive option
 * @param args.mode - Fetch mode option ('cors', 'no-cors', 'same-origin')
 *
 * @returns A type-safe API client function with interceptor management capabilities
 *
 * @throws {ApiError} When endpoint key is invalid or endpoint not found
 * @throws {ValidationError} When request/response validation fails
 * @throws {NetworkError} When network requests fail
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { defineApiSchema, createApiClient } from 'mock-dash'
 *
 * const apiSchema = defineApiSchema({
 *   '@get/users/:id': {
 *     input: {
 *       param: z.object({ id: z.string() }),
 *       query: z.object({ include: z.string().optional() })
 *     },
 *     response: z.object({
 *       id: z.string(),
 *       name: z.string(),
 *       email: z.string().email()
 *     })
 *   },
 *   '@post/users': {
 *     input: {
 *       json: z.object({
 *         name: z.string().min(1),
 *         email: z.string().email()
 *       })
 *     },
 *     response: z.object({
 *       id: z.string(),
 *       name: z.string(),
 *       email: z.string()
 *     })
 *   }
 * })
 *
 * const client = createApiClient({
 *   apiSchema,
 *   baseURL: 'https://api.example.com',
 *   headers: {
 *     'Authorization': 'Bearer token123'
 *   }
 * })
 *
 * // Type-safe API calls with full IntelliSense
 * const user = await client('@get/users/:id', {
 *   param: { id: '123' },
 *   query: { include: 'profile' }
 * })
 *
 * const newUser = await client('@post/users', {
 *   json: {
 *     name: 'John Doe',
 *     email: 'john@example.com'
 *   }
 * })
 *
 * // Add request interceptor for authentication
 * client.interceptors.request.use((context, options) => {
 *   return {
 *     ...options,
 *     headers: {
 *       ...options.headers,
 *       'Authorization': `Bearer ${getAuthToken()}`
 *     }
 *   }
 * })
 *
 * // Add response interceptor for error handling
 * client.interceptors.response.use((context, response) => {
 *   if (response.status === 401) {
 *     redirectToLogin()
 *   }
 *   return response
 * })
 * ```
 */
export function createApiClient<T extends Record<string, unknown>>(
  args: {
    apiSchema: T
    baseURL: string
    transformRequest?: InterceptorCallback<ApiSchemaEndpoints<T>, FetchOptions>
    transformResponse?: InterceptorCallback<ApiSchemaEndpoints<T>, Response>
  } & FetchOptions,
): Client<ApiSchemaEndpoints<T>> {
  const {
    apiSchema,
    baseURL,
    headers: clientHeaders,
    transformRequest,
    transformResponse,
    ...clientOptions
  } = args

  const properties: ClientProperties<ApiSchemaEndpoints<T>> = {
    interceptors: {
      request: new InterceptorManager<ApiSchemaEndpoints<T>, FetchOptions>(),
      response: new InterceptorManager<ApiSchemaEndpoints<T>, Response>(),
    },
    overrides: {},
  }

  const mergedEndpointMap: Record<
    string,
    IEndpoint<`@post/${string}`, z.ZodType | z.ZodArray>
  > = {}

  Object.values(apiSchema).forEach((apiDefinition) => {
    // Handle individual Endpoint instances
    if (isEndpoint(apiDefinition)) {
      const [key, e] = apiDefinition.getEntry()
      mergedEndpointMap[key] = e
    }

    // Handle Endpoints class instances (plural API)
    if (isEndpoints(apiDefinition)) {
      const entries = apiDefinition.getEntries()
      for (const [key, endpoint] of entries) {
        mergedEndpointMap[key] = endpoint
      }
    }
  })

  const requestApi = async (
    endpointKey: keyof ApiSchemaEndpoints<T> & string,
    args: Partial<ValidationTargets> & FetchOptions = {},
  ): Promise<unknown> => {
    const {
      form,
      json,
      param,
      query,
      headers: requestHeaders,
      ...requestOptions
    } = args
    const data = { form, json, param, query }

    if (!endpointKey.startsWith('@')) {
      throw new ApiError(
        `Invalid endpoint key: ${endpointKey}. It should start with '@' followed by the HTTP method.`,
        400,
      )
    }

    const endpoint = mergedEndpointMap[endpointKey]
    if (!endpoint) {
      throw new ApiError(`Endpoint not found: ${endpointKey}`, 404)
    }

    const parts = endpointKey.split('/')
    const httpMethodPart = parts[0].replace('@', '')
    const methodResult = httpMethodSchema.safeParse(httpMethodPart)
    if (!methodResult.success) {
      throw new ApiError(`${httpMethodPart} is not a valid HTTP method.`, 404)
    }
    const method = methodResult.data
    let fullUrl = buildEndpointPath(endpointKey, endpoint.prefix, baseURL)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(clientHeaders || {}),
      ...(requestHeaders || {}),
    }

    let options: RequestInit = {
      ...clientOptions,
      ...requestOptions,
      method,
      headers,
    }

    // Handle URL parameters
    if (data?.param) {
      for (const key in data.param) {
        if (Object.hasOwn(data.param, key)) {
          fullUrl = fullUrl.replace(`:${key}`, data.param[key])
        } else {
          throw new ApiError(
            `Missing URL parameter ${key} for endpoint ${endpointKey}`,
            400,
            {
              url: fullUrl,
              method: method.toUpperCase(),
            },
          )
        }
      }
    }

    // Check for missing URL parameters in the path
    const missingParams = endpointKey.match(/:(\w+)/g)
    if (
      missingParams &&
      (!data ||
        !data.param ||
        missingParams.some((param) => !data.param?.[param.slice(1)]))
    ) {
      const missingParam = missingParams.find(
        (param) => !data || !data.param || !data.param[param.slice(1)],
      )
      if (missingParam) {
        throw new ApiError(
          `Missing URL parameter ${missingParam.slice(1)} for endpoint ${endpointKey}`,
          400,
          {
            url: fullUrl,
            method: method.toUpperCase(),
          },
        )
      }
    }

    // Validate request data against input schemas
    if (endpoint.input && data) {
      for (const [inputType, schema] of Object.entries(endpoint.input)) {
        const inputData = data[inputType as keyof typeof data]
        if (inputData !== undefined) {
          const validationResult = (
            schema instanceof z.ZodType ? schema : z.object(schema)
          ).safeParse(inputData)
          if (!validationResult.success) {
            throw new ValidationError(
              `Request validation failed for ${inputType}`,
              validationResult.error,
              'request',
              {
                url: fullUrl,
                method: method.toUpperCase(),
              },
            )
          }
        }
      }
    }

    // Handle query parameters
    if (data?.query) {
      const queryString = serializeQueryParams(data.query)
      if (queryString) {
        fullUrl += `?${queryString}`
      }
    }

    // Handle body or bodyForm
    if (method !== 'get' && data) {
      if (endpoint.input?.json && data.json) {
        options.body = JSON.stringify(data.json)
      } else if (endpoint.input?.form && data.form) {
        if ('Content-Type' in headers) delete headers['Content-Type'] // Let the browser set the correct Content-Type for form data

        options.body = buildFormData(data.form)
      }
    }

    // Enhanced interceptor context with proper typing
    const inputs = data as Args<
      ApiSchemaEndpoints<T>,
      keyof ApiSchemaEndpoints<T>
    >[0]
    const interceptorContext: InterceptorContext<
      ApiSchemaEndpoints<T>,
      keyof ApiSchemaEndpoints<T>
    > = {
      key: endpointKey,
      inputs,
      method,
      path: fullUrl,
    }

    if (transformRequest) {
      const transformed = await transformRequest(interceptorContext, options)
      if (transformed !== undefined) {
        options = transformed
      }
    }

    options = await properties.interceptors.request.runAll(
      interceptorContext,
      options,
    )

    let response: Response
    try {
      response = await (properties.overrides.fetch || fetch)(fullUrl, options)
    } catch (error) {
      // Handle network errors (connection failures, timeouts, etc.)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(`Network request failed: ${error.message}`, {
          url: fullUrl,
          method: method.toUpperCase(),
          cause: error,
        })
      }
      // Handle AbortError for timeouts
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout', {
          url: fullUrl,
          method: method.toUpperCase(),
          timeout: true,
          cause: error,
        })
      }
      // Re-throw other errors as NetworkError
      throw new NetworkError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          url: fullUrl,
          method: method.toUpperCase(),
          cause: error instanceof Error ? error : undefined,
        },
      )
    }

    if (transformResponse) {
      const transformedResponse = await transformResponse(
        interceptorContext,
        response,
      )
      if (transformedResponse !== undefined) {
        response = transformedResponse
      }
    }

    response = await properties.interceptors.response.runAll(
      interceptorContext,
      response,
    )

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

      throw new ApiError(
        `API call failed with status ${response.status}`,
        response.status,
        {
          body: errorBody,
          url: fullUrl,
          method: method.toUpperCase(),
        },
      )
    }

    let jsonResponse: unknown
    try {
      if (
        endpoint.response instanceof z.ZodString ||
        endpoint.response instanceof z.ZodStringFormat
      ) {
        jsonResponse = await response.text()
      } else if (endpoint.response instanceof z.ZodVoid) {
        jsonResponse = undefined
      } else {
        jsonResponse = await response.json()
      }
    } catch (error) {
      throw new ApiError('Failed to parse response as JSON', response.status, {
        url: fullUrl,
        method: method.toUpperCase(),
        cause: error instanceof Error ? error : undefined,
      })
    }

    // Zod validation on the response
    const validationResult = endpoint.response.safeParse(jsonResponse)
    if (!validationResult.success) {
      throw new ValidationError(
        'Response validation failed',
        validationResult.error,
        'response',
        {
          status: response.status,
          body: jsonResponse,
          url: fullUrl,
          method: method.toUpperCase(),
        },
      )
    }

    return validationResult.data
  }

  return Object.assign(
    requestApi as ClientFn<ApiSchemaEndpoints<T>>,
    properties,
  )
}
