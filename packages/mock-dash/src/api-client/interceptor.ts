/** Runtime context passed to interceptor callbacks */
export interface InterceptorContext {
  readonly method?: string
  readonly path: string
}

/** Function shape for interceptor handlers */
export type InterceptorCallback<D> = (
  context: InterceptorContext,
  data: D,
) => D | Promise<D>

/**
 * Manages a collection of interceptor callbacks and provides methods to add, remove, and execute them.
 * Interceptors are executed in the order they were added, and each interceptor receives the result
 * of the previous interceptor in the chain.
 */
/** Registers and executes a chain of interceptor callbacks */
export class InterceptorManager<D> {
  private readonly callbacks: Array<InterceptorCallback<D>> = []

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
  public addInterceptor(callback: InterceptorCallback<D>): () => void {
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
  public use(callback: InterceptorCallback<D>): () => void {
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
  public async runAll(context: InterceptorContext, data: D): Promise<D> {
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
