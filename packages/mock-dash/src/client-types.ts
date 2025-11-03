import type z from 'zod'
import type { HttpMethodPath, InputsWithParams } from './common-types'
import type { Endpoint, Endpoints, IEndpoint } from './endpoints'
import type { EmptyObjectIsNever, UnionToIntersection } from './type-utils'

type ApiSchema = Record<
  string,
  IEndpoint<HttpMethodPath, z.ZodType | z.ZodArray>
>

type FlattenEndpointsToUnion<T> = {
  [K in keyof T]: T[K] extends Endpoint<infer EndpointKey, any>
    ? {
        [P in EndpointKey]: T[K] extends Endpoint<any, infer EndpointDef>
          ? EndpointDef
          : never
      }
    : T[K] extends Endpoints<infer EndpointsType>
      ? {
          [P in keyof EndpointsType]: EndpointsType[P] extends IEndpoint<
            HttpMethodPath,
            z.ZodType | z.ZodArray
          >
            ? EndpointsType[P]
            : never
        }
      : never
}[keyof T]

type FlattenEndpoints<T> = UnionToIntersection<
  FlattenEndpointsToUnion<T>
> extends infer Result
  ? Result extends ApiSchema
    ? Result
    : Record<string, never>
  : Record<string, never>

export type ApiSchemaEndpoints<T extends Record<string, unknown>> =
  FlattenEndpoints<T>

/**
 * Inferred argument tuple for a given endpoint key. Empty input => no arg required.
 */
export type Args<
  T extends ApiSchema,
  K extends keyof T,
> = K extends HttpMethodPath
  ? T[K] extends IEndpoint<K, T[K]['response']>
    ? EmptyObjectIsNever<InputsWithParams<K, T[K]['input']>> extends never
      ? [options?: FetchOptions]
      : [data: InputsWithParams<K, T[K]['input']> & FetchOptions]
    : never
  : never

/** Core callable signature for the generated API client */
export type ClientFn<T extends ApiSchema> = <K extends keyof T>(
  key: K,
  ...args: Args<T, K>
) => T[K] extends IEndpoint<HttpMethodPath, z.ZodType | z.ZodArray>
  ? Promise<z.infer<T[K]['response']>>
  : never

/** Runtime context passed to interceptor callbacks */
export interface InterceptorContext<
  T extends ApiSchema,
  K extends keyof T = keyof T,
> {
  readonly key: K
  readonly inputs: Args<T, K>[0]
  readonly method: string
  readonly path: string
}

/** Function shape for interceptor handlers */
export type InterceptorCallback<
  T extends ApiSchema,
  D,
  K extends keyof T = keyof T,
> = (context: InterceptorContext<T, K>, data: D) => D | Promise<D>

/**
 * Manages a collection of interceptor callbacks and provides methods to add, remove, and execute them.
 * Interceptors are executed in the order they were added, and each interceptor receives the result
 * of the previous interceptor in the chain.
 */
/** Registers and executes a chain of interceptor callbacks */
export class InterceptorManager<T extends ApiSchema, D> {
  private readonly callbacks: Array<InterceptorCallback<T, D>> = []

  /**
   * Adds an interceptor callback to the manager. The callback will be executed
   * for all requests/responses in the order it was added.
   *
   * @param callback - The interceptor function to add
   * @returns A cleanup function that removes the interceptor when called
   *
   * @example
   * ```typescript
   * // Add request interceptor for logging
   * const removeLogger = client.interceptors.request.use((context, options) => {
   *   console.log(`Making ${context.method.toUpperCase()} request to ${context.path}`)
   *   return options
   * })
   *
   * // Add response interceptor for error handling
   * const removeErrorHandler = client.interceptors.response.use(async (context, response) => {
   *   if (!response.ok) {
   *     console.error(`Request failed: ${response.status} ${response.statusText}`)
   *   }
   *   return response
   * })
   *
   * // Remove interceptors later
   * removeLogger()
   * removeErrorHandler()
   * ```
   */
  public addInterceptor(callback: InterceptorCallback<T, D>): () => void {
    this.callbacks.push(callback)

    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Alias for addInterceptor that follows the common interceptor pattern used by libraries like Axios.
   * This provides a more familiar API for developers coming from other HTTP client libraries.
   *
   * @param callback - The interceptor function to add
   * @returns A cleanup function that removes the interceptor when called
   *
   * @example
   * ```typescript
   * // Familiar syntax for developers coming from Axios
   * const removeInterceptor = client.interceptors.request.use((context, options) => {
   *   // Add authentication header
   *   return {
   *     ...options,
   *     headers: {
   *       ...options.headers,
   *       'Authorization': `Bearer ${token}`
   *     }
   *   }
   * })
   * ```
   */
  public use(callback: InterceptorCallback<T, D>): () => void {
    return this.addInterceptor(callback)
  }

  /**
   * Executes all registered interceptor callbacks in sequence, passing the result
   * of each interceptor to the next one in the chain.
   *
   * @param context - The interceptor context containing request information
   * @param data - The initial data to be processed by the interceptors
   * @returns The final data after all interceptors have been applied
   *
   * @internal
   */
  public async runAll(context: InterceptorContext<T>, data: D): Promise<D> {
    let currentData = data

    for (const callback of this.callbacks) {
      const result = await callback(context, currentData)
      if (result !== undefined) {
        currentData = result
      }
    }

    return currentData
  }
}

/** Additional properties attached to the client function */
export interface ClientProperties<T extends ApiSchema> {
  interceptors: {
    response: InterceptorManager<T, Response>
    request: InterceptorManager<T, FetchOptions>
  }
  overrides: {
    fetch?: typeof fetch
  }
}

/** Full API client type (callable + attached properties) */
export type Client<T extends ApiSchema> = ClientFn<T> & ClientProperties<T>

/** Supported subset of RequestInit options accepted by the client */
export type FetchOptions = Omit<RequestInit, 'body' | 'window' | 'method'>
