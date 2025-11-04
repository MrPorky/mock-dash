import {
  HttpEndpoint,
  isHttpEndpointWithZodResponse,
} from '../http-endpoint/http-endpoint'
import {
  isHttpEndpointWithStreamResponse,
  isWebSocketResponse,
} from '../http-endpoint/stream-response'
import { deepMerge } from '../utils/deep-merge'
import type { Combine } from '../utils/types'
import type { CreateApiClientArgs, FetchOptions } from './client-base'
import { InterceptorManager } from './interceptor'
import { callHttpEndpoint, type HttpEndpointCall } from './rest-call'
import { callStreamEndpoint } from './sse-call'
import { callWebSocketEndpoint } from './ws-call'

/**
 * Maps path parameters to functions that build the client path object.
 */
type PathParameterMapper<
  K extends string,
  P extends string,
  E extends HttpEndpoint,
> = K extends `:${infer PARAM}`
  ? {
      [KEY in PARAM]: (value: string) => ClientPathObject<P, E>
    }
  : {
      [KEY in K]: ClientPathObject<P, E>
    }

/**
 * Recursively builds the client path object.
 */
type ClientPathObject<
  P extends string,
  E extends HttpEndpoint,
> = P extends `/${infer PATH}`
  ? PATH extends `${infer SEGMENT}/${infer REST}`
    ? PathParameterMapper<SEGMENT, `/${REST}`, E>
    : PathParameterMapper<PATH, '', E>
  : EndpointCall<E>

/**
 * Maps an HttpEndpoint to its corresponding call type.
 */
type EndpointCall<T extends HttpEndpoint> = T extends HttpEndpoint
  ? HttpEndpointCall<T>
  : never

/**
 * The API client type built from the API schema.
 */
type Client<T = Record<string, unknown>> = Combine<
  {
    [K in keyof T]: T[K] extends HttpEndpoint<infer P>
      ? ClientPathObject<P, T[K]>
      : never
  }[keyof T]
>

export function createApiClient<ApiSchema extends Record<string, unknown>>(
  args: CreateApiClientArgs<ApiSchema>,
) {
  const { apiSchema, transformRequest, transformResponse, ...requestOptions } =
    args

  const interceptors = {
    request: new InterceptorManager<FetchOptions>(),
    response: new InterceptorManager<Response>(),
  }

  if (transformRequest) interceptors.request.addInterceptor(transformRequest)

  if (transformResponse) interceptors.response.addInterceptor(transformResponse)

  const apiRoot = {} as Client<ApiSchema>
  Object.entries(apiSchema).forEach(([_endpointKey, endpoint]) => {
    if (endpoint instanceof HttpEndpoint) {
      const segments = parsePath(endpoint.path)
      // Merge the new structure into the existing apiRoot
      deepMerge(
        apiRoot,
        buildNode(segments, endpoint, requestOptions, interceptors),
      )
    }
  })

  return { ...apiRoot, interceptors }
}

type ParsedSegment =
  | { type: 'resource'; name: string }
  | { type: 'param'; name: string }

function parsePath(path: string): ParsedSegment[] {
  // 1. Remove leading/trailing slashes and split by '/'
  const segments = path.replace(/^\/|\/$/g, '').split('/')

  return segments.map((segment) => {
    if (segment.startsWith(':')) {
      // It's a path parameter
      return { type: 'param', name: segment.substring(1) }
    } else {
      // It's a static resource name
      return { type: 'resource', name: segment }
    }
  })
}

function buildNode(
  segments: ParsedSegment[],
  endpoint: unknown,
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
  pathParams: Record<string, string> = {}, // Accumulated parameters
) {
  if (segments.length === 0) {
    if (isHttpEndpointWithStreamResponse(endpoint)) {
      // Check if it's a WebSocket endpoint
      if (isWebSocketResponse(endpoint.response)) {
        const apiCall = callWebSocketEndpoint(
          pathParams,
          endpoint as any,
          requestOptions,
          interceptors,
        )

        return {
          [endpoint.method]: { $ws: apiCall },
        }
      }

      // Otherwise, it's an SSE/JSON/Binary stream endpoint
      const apiCall = callStreamEndpoint(
        pathParams, // You need logic to extract these
        endpoint,
        requestOptions,
        interceptors,
      )

      return {
        [endpoint.method]: { $stream: apiCall },
      }
    }

    if (isHttpEndpointWithZodResponse(endpoint)) {
      const apiCall = callHttpEndpoint(
        pathParams,
        endpoint,
        requestOptions,
        interceptors,
      )

      return {
        [endpoint.method]: apiCall,
      }
    }

    return 'not yet implemented or unknown endpoint type'
  }

  const [currentSegment, ...restSegments] = segments
  const node: Record<string, any> = {}

  if (currentSegment.type === 'resource') {
    // 1. RESOURCE: Attach the next part of the tree
    node[currentSegment.name] = buildNode(
      restSegments,
      endpoint,
      requestOptions,
      interceptors,
      pathParams,
    )
  } else if (currentSegment.type === 'param') {
    // 2. PARAMETER: Attach a function that captures the param value
    const paramKey = currentSegment.name

    node[paramKey] = (paramValue: string) => {
      // Create a new set of params for the recursion
      const newParams = { ...pathParams, [paramKey]: paramValue }

      // Continue building the rest of the path from this point
      return buildNode(
        restSegments,
        endpoint,
        requestOptions,
        interceptors,
        newParams,
      )
    }
  }

  return node
}
