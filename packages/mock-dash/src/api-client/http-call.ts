import z from 'zod'
import type { $ZodErrorTree } from 'zod/v4/core'
import type { HttpEndpoint } from '../endpoint/http-endpoint'
import type { EndpointInputType } from '../endpoint/input'
import { createCoercingSchema } from '../utils/create-coercing-schema'
import type { Errors } from '../utils/errors'
import { ApiError, ValidationError } from '../utils/errors'
import { extractFromFormData } from '../utils/extract-from-form-data'
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
> = {
  // Form data parsing signature
  safeParseForm: I extends { json: z.ZodObject }
    ? (
        formData: FormData,
        autoCoerce?: boolean,
      ) =>
        | { success: boolean; data: z.infer<R>; error?: undefined }
        | { success: boolean; data?: undefined; error: $ZodErrorTree<R> }
    : never
  // Call signature
  (
    ...args: EndpointArgs<I>
  ): Promise<
    | { data: z.infer<R>; response: Response; error?: never }
    | { data?: never; error: Errors; response?: Response }
  >
  // Throwing version
  orThrow: (...args: EndpointArgs<I>) => Promise<z.infer<R>>
}

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
): HttpEndpointCallSignature<z.ZodType, Required<EndpointInputType>> {
  const fn = async (
    inputData: EndpointArgs<Required<EndpointInputType>>[0],
  ) => {
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

  const orThrowFn = async (
    ...args: EndpointArgs<Required<EndpointInputType>>
  ): Promise<z.infer<z.ZodType>> => {
    const result = await fn(...args)
    if (result.error) {
      throw result.error
    }
    return result.data
  }

  if (endpoint.input?.json instanceof z.ZodObject) {
    let schema = endpoint.input.json

    return Object.assign(fn, {
      orThrow: orThrowFn,
      safeParseForm: (formData: FormData, autoCoerce = true) => {
        schema = autoCoerce ? createCoercingSchema(schema) : schema
        const result = extractFromFormData(formData, schema)

        if (!result.success) {
          const error = z.treeifyError(result.error)
          return {
            success: false,
            error: error,
          }
        }

        return {
          success: true,
          data: result.data,
        }
      },
    })
  }

  return Object.assign(fn, {
    orThrow: orThrowFn,
    safeParseForm: () => {
      throw new Error('No JSON input schema defined for this endpoint')
    },
  })
}
