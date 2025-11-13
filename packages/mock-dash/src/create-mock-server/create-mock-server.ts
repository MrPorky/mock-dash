import type { createNodeWebSocket } from '@hono/node-ws'
import { zValidator } from '@hono/zod-validator'
import { Hono, type ValidationTargets } from 'hono'
import { type SSEMessage, stream, streamSSE } from 'hono/streaming'
import type { SendOptions, UpgradeWebSocket, WSContext } from 'hono/ws'
import z from 'zod'
import { Endpoint } from '../endpoint/endpoint'
import { isHttpEndpoint } from '../endpoint/http-endpoint'
import {
  isBinaryStreamEndpoint,
  isJSONStreamEndpoint,
  isSSEEndpoint,
  isStreamEndpoint,
} from '../endpoint/stream-endpoint'
import {
  isWebSocketEndpoint,
  type WebSocketEndpoint,
} from '../endpoint/ws-endpoint'
import { buildEndpointPath } from '../utils/build-endpoint-path'
import { createMock } from '../utils/create-mock'
import { MockError } from '../utils/errors'
import { isBinaryArrayBuffer } from '../utils/type-guards'
import type { EndpointInputContext } from './mock'

export interface MockGenerationOptions {
  readonly base?: string
  readonly addMiddleware?: (app: Hono) => void
  readonly zodToMock?: <Z extends z.ZodType>(response: Z) => z.infer<Z>
  readonly createNodeWebSocket?: typeof createNodeWebSocket
  readonly upgradeWebSocket?: UpgradeWebSocket
}

export function createMockServer<T extends Record<string, unknown>>(
  apiSchema: T,
  options: MockGenerationOptions = {},
) {
  const app = new Hono().basePath(options.base ?? '')
  const { injectWebSocket, upgradeWebSocket: nodeUpgradeWebSocket } =
    options.createNodeWebSocket ? options.createNodeWebSocket({ app }) : {}
  const upgradeWebSocket = options.upgradeWebSocket || nodeUpgradeWebSocket

  options.addMiddleware?.(app)

  function processEndpoint(
    endpoint: Endpoint,
    //mock?: IMock<HttpMethodPath, z.ZodType | ZodArray<z.ZodType>, any>,
  ) {
    if (isWebSocketEndpoint(endpoint) && !upgradeWebSocket) {
      throw new Error('options.upgradeWebSocket is not defined')
    }

    const method = endpoint.method
    const path = buildEndpointPath(endpoint.path, endpoint.options?.alias)

    const inputValidators = endpoint.input
      ? Object.entries(endpoint.input).map(([target, zodType]) =>
          zValidator(
            target as keyof ValidationTargets,
            zodType instanceof z.ZodType ? zodType : z.object(zodType),
          ),
        )
      : []

    app[method](path, ...inputValidators, async (c, next) => {
      try {
        const inputs = {
          query: c.req.query(),
          json: await c.req.json().catch(() => ({})),
          form: await c.req.parseBody().catch(() => ({})),
          param: c.req.param(),
        }

        const fakerContext: EndpointInputContext<any> = {
          // @ts-expect-error TS cannot infer the type here
          inputs,
          endpoint,
          honoContext: c,
        }

        if (isWebSocketEndpoint(endpoint)) {
          function modifyWsContext(ws: WSContext, endpoint: WebSocketEndpoint) {
            const clonews = Object.assign(
              Object.create(Object.getPrototypeOf(ws)),
              ws,
            ) as WSContext

            clonews.send = (data: unknown, options?: SendOptions) => {
              const result = z
                .union(endpoint.response.serverToClient)
                .safeParse(data)

              if (!result.success) {
                throw new MockError('Invalid WebSocket message', 400)
              }

              if (
                typeof result.data === 'string' ||
                result.data instanceof ArrayBuffer ||
                isBinaryArrayBuffer(result.data)
              )
                ws.send.call(ws, result.data, options)
              else ws.send.call(ws, JSON.stringify(result.data), options)
            }

            return clonews
          }

          const upgradedWebSocketHandler = upgradeWebSocket!((_c) => {
            let mock = endpoint.getMock()
            if (!mock) {
              mock = {
                onClose() {
                  console.info('WebSocket connection closed')
                },
                onError() {
                  console.error('WebSocket error occurred')
                },
                onMessage(_ev, _ws) {
                  console.warn('WebSocket message received but no mock defined')
                },
                onOpen() {
                  console.info('WebSocket connection opened')
                },
              }
            }

            if (typeof mock === 'function') {
              mock = mock(fakerContext)
            }

            return {
              onClose(evt, ws) {
                const modifiedWs = modifyWsContext(ws, endpoint)

                mock.onClose?.(evt, modifiedWs)
              },
              onError(evt, ws) {
                const modifiedWs = modifyWsContext(ws, endpoint)

                mock.onError?.(evt, modifiedWs)
              },
              onMessage(evt, ws) {
                let data = evt.data
                if (typeof data === 'string') {
                  try {
                    data = JSON.parse(data)
                  } catch {
                    // Keep original data if JSON parsing fails
                  }
                }

                const result = z
                  .union(endpoint.response.clientToServer)
                  .safeParse(data)

                if (!result.success) {
                  throw new MockError('Invalid WebSocket message', 400)
                }

                const modifiedWs = modifyWsContext(ws, endpoint)

                mock.onMessage?.({ ...evt, data: result.data }, modifiedWs)
              },
              onOpen(evt, ws) {
                const modifiedWs = modifyWsContext(ws, endpoint)

                mock.onOpen?.(evt, modifiedWs)
              },
            }
          })

          // @ts-expect-error Cannot infer types here
          return upgradedWebSocketHandler(c, next)
        }

        if (isSSEEndpoint(endpoint)) {
          return streamSSE(c, async (stream) => {
            const cloneStream = Object.assign(
              Object.create(Object.getPrototypeOf(stream)),
              stream,
            )

            const write = async (
              message: Omit<SSEMessage, 'data'> & { data: unknown },
            ) => {
              if (
                !Object.keys(endpoint.response.events).includes(
                  message.event || 'message',
                )
              ) {
                throw new MockError(
                  `Unknown SSE event name: "${message.event}"`,
                  400,
                )
              }

              const schema =
                endpoint.response.events[message.event || 'message']

              if (!schema) {
                throw new MockError(
                  `Unknown SSE event name: "${message.event}"`,
                  400,
                )
              }

              let dataToValidate = message.data
              if (message.data instanceof Promise) {
                dataToValidate = await message.data
              }

              const validation = schema.safeParse(dataToValidate)
              if (!validation.success) {
                throw new MockError('Invalid SSE message', 400)
              }

              await stream.writeSSE({
                ...message,
                event: message.event || 'message',
                data: JSON.stringify(validation.data),
              })
            }

            Object.assign(cloneStream, {
              write,
            })

            const mock = endpoint.getMock()
            if (mock) {
              await mock({ ...fakerContext, stream: cloneStream })
            } else {
              if (!options.zodToMock)
                throw new MockError(
                  'No mock defined for SSE endpoint and zodToMock is not provided',
                  500,
                )

              // Default mock behavior: send one message per event type
              for (const [eventName, schema] of Object.entries(
                endpoint.response.events,
              )) {
                const mockData = options.zodToMock(
                  schema as z.ZodType,
                ) as unknown
                await write({ event: eventName, data: mockData })
              }
            }
          })
        }

        if (isJSONStreamEndpoint(endpoint)) {
          return stream(c, async (stream) => {
            c.header('Content-Type', 'application/x-ndjson')

            const cloneStream = Object.assign(
              Object.create(Object.getPrototypeOf(stream)),
              stream,
            )

            const schema = endpoint.response.itemSchema

            const writeBase = async (data: unknown, ln: boolean) => {
              const result = schema.safeParse(data)
              if (!result.success) {
                throw new MockError('Invalid JSON stream item', 400)
              }

              if (result.data instanceof Uint8Array) {
                stream.write(result.data)
                return
              }

              if (typeof result.data === 'string') {
                ln ? stream.writeln(result.data) : stream.write(result.data)
              } else {
                const jsonString = JSON.stringify(result.data)

                ln ? stream.writeln(jsonString) : stream.write(jsonString)
              }
            }

            const mock = endpoint.getMock()
            if (mock) {
              Object.assign(cloneStream, {
                write: (data: unknown) => writeBase(data, false),
                writeln: (data: unknown) => writeBase(data, true),
              })

              await mock({ ...fakerContext, stream: cloneStream })
            } else {
              if (!options.zodToMock)
                throw new MockError(
                  'No mock defined for SSE endpoint and zodToMock is not provided',
                  500,
                )

              writeBase(options.zodToMock(endpoint.response.itemSchema), false)
            }
          })
        }

        if (isBinaryStreamEndpoint(endpoint)) {
          return stream(c, async (stream) => {
            c.header('Content-Type', endpoint.response.contentType)

            const mock = endpoint.getMock()

            if (mock) {
              await mock({ ...fakerContext, stream })
            } else {
              await stream.write(new Uint8Array([1, 2, 3, 4]))
            }
          })
        }

        if (isStreamEndpoint(endpoint)) {
          throw new MockError('Unsupported stream endpoint type', 500)
        }

        if (isHttpEndpoint(endpoint)) {
          const mock = endpoint.getMock()

          if (!mock && !options.zodToMock) {
            return c.text('No mock defined for endpoint', 500)
          }

          let result: unknown
          if (mock) result = await createMock(mock, fakerContext)
          else if (options.zodToMock)
            result = options.zodToMock(endpoint.response)

          if (endpoint.response instanceof z.ZodVoid) {
            return c.body(null)
          }

          if (
            endpoint.response instanceof z.ZodString ||
            endpoint.response instanceof z.ZodStringFormat
          ) {
            if (typeof result !== 'string') {
              return c.json({ message: 'a string is expected' }, 400)
            }

            return c.text(result)
          }

          return c.json(result)
        }

        return c.text('Endpoint definition not implemented', 400)
      } catch (error) {
        if (error instanceof MockError) {
          return c.text(error.message, error.status)
        }
      }
    })
  }

  for (const apiDefinition of Object.values(apiSchema)) {
    // if (apiDefinition instanceof Collection) {
    //   apiDefinition.initialize(fake)
    //   continue
    // }

    if (apiDefinition instanceof Endpoint) {
      processEndpoint(apiDefinition)
    }
  }

  return { app, injectWebSocket }
}
