import { Endpoint, type EndpointPath } from '../endpoint/endpoint'
import { isHttpEndpoint } from '../endpoint/http-endpoint'
import type { ParsedPathParameters } from '../endpoint/input'
import { isStreamEndpoint } from '../endpoint/stream-endpoint'
import { isWebSocketEndpoint } from '../endpoint/ws-endpoint'
import { buildEndpointPath } from '../utils/build-endpoint-path'
import { toCamelCase } from '../utils/to-camel-case'
import type { EmptyObjectIsNever, RemoveNever } from '../utils/types'
import type { CreateApiClientArgs, FetchOptions } from './client-base'
import type { Client } from './client-type'
import { callHttpEndpoint } from './http-call'
import type { InferClient } from './infer-type'
import { InterceptorManager } from './interceptor'
import { callStreamEndpoint } from './stream-call'
import { callWebSocketEndpoint } from './ws-call'

type ParsedSegment =
  | { type: 'resource'; name: string }
  | { type: 'param'; name: string }

function parsePath(path: string): ParsedSegment[] {
  const segments = path.replace(/^\/|\/$/g, '').split('/')
  return segments.filter(Boolean).map((segment) => {
    const paramMatch = segment.match(/^:(.*)$/)

    if (paramMatch) {
      return { type: 'param', name: paramMatch[1] }
    } else {
      const resourceName = segment.replace(/^\{(.*)\}$/, '$1')

      return { type: 'resource', name: resourceName }
    }
  })
}

interface PathNode {
  segmentType: 'root' | 'resource' | 'param'
  endpoints: Endpoint[]
  children: Map<string, PathNode>
}

function buildPathTree(endpoints: Endpoint[]): PathNode {
  const root: PathNode = {
    segmentType: 'root',
    endpoints: [],
    children: new Map(),
  }

  endpoints.forEach((endpoint) => {
    const segments = parsePath(endpoint.path)

    let currentNode = root
    for (const segment of segments) {
      const segmentKey = segment.name

      if (!currentNode.children.has(segmentKey)) {
        currentNode.children.set(segmentKey, {
          segmentType: segment.type,
          endpoints: [],
          children: new Map(),
        })
      }
      currentNode = currentNode.children.get(segmentKey)!
    }

    currentNode.endpoints.push(endpoint)
  })

  return root
}

function buildApiClientFromTree(
  node: PathNode,
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
  pathParams: Record<string, string> = {},
): Record<string, any> {
  const clientNode: Record<string, any> = {}

  for (const endpoint of node.endpoints) {
    if (isHttpEndpoint(endpoint)) {
      clientNode[endpoint.method] = callHttpEndpoint(
        pathParams,
        endpoint,
        requestOptions,
        interceptors,
      )
    } else if (isStreamEndpoint(endpoint)) {
      clientNode[endpoint.method] = {
        ...clientNode[endpoint.method],
        $stream: callStreamEndpoint(
          pathParams,
          endpoint,
          requestOptions,
          interceptors,
        ),
      }
    } else if (isWebSocketEndpoint(endpoint)) {
      clientNode[endpoint.method] = {
        ...clientNode[endpoint.method],
        $ws: callWebSocketEndpoint(
          pathParams,
          endpoint,
          requestOptions,
          interceptors,
        ),
      }
    } else if (endpoint instanceof Endpoint) {
      clientNode[endpoint.method] =
        'not yet implemented or unknown endpoint type'
    }
  }

  for (const [key, childNode] of node.children.entries()) {
    const clientKey = toCamelCase(key)

    if (childNode.segmentType === 'resource') {
      clientNode[clientKey] = {
        ...clientNode[clientKey],
        ...buildApiClientFromTree(
          childNode,
          requestOptions,
          interceptors,
          pathParams,
        ),
      }
    } else if (childNode.segmentType === 'param') {
      clientNode[clientKey] = (paramValue: string) => {
        const newParams = { ...pathParams, [key]: paramValue }

        return buildApiClientFromTree(
          childNode,
          requestOptions,
          interceptors,
          newParams,
        )
      }
    }
  }

  return clientNode
}

export function createApiClient<ApiSchema extends Record<string, unknown>>(
  args: CreateApiClientArgs<ApiSchema>,
): {
  api: Client<ApiSchema>
  infer: InferClient<ApiSchema>
  interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  }
  createEndpointUri: <P extends EndpointPath>(
    path: P,
    ...args: EmptyObjectIsNever<
      RemoveNever<ParsedPathParameters<P>>
    > extends never
      ? []
      : [ParsedPathParameters<P>]
  ) => string
} {
  const { apiSchema, transformRequest, transformResponse, ...requestOptions } =
    args

  const interceptors = {
    request: new InterceptorManager<FetchOptions>(),
    response: new InterceptorManager<Response>(),
  }

  if (transformRequest) interceptors.request.addInterceptor(transformRequest)

  if (transformResponse) interceptors.response.addInterceptor(transformResponse)

  const endpoints = Object.values(apiSchema).filter(
    (e): e is Endpoint => e instanceof Endpoint,
  )

  const pathTree = buildPathTree(endpoints)
  const api = buildApiClientFromTree(
    pathTree,
    requestOptions,
    interceptors,
    {},
  ) as Client<ApiSchema>

  return {
    api,
    interceptors,
    infer: {} as InferClient<ApiSchema>,
    createEndpointUri: (path, ...args) => {
      const param = (args[0] || {}) as Record<string, string>

      let url = buildEndpointPath(
        path,
        requestOptions.alias,
        requestOptions.baseURL,
      )

      for (const [key, value] of Object.entries(param)) {
        url = url.replace(`:${key}`, String(value)) // Ensure value is a string
      }

      return url
    },
  }
}
