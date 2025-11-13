import {
  chatMessageModel,
  dataStreamModel,
  productModel,
  sseMessageModel,
  userModel,
} from '@examples/shared'
import {
  createApiClient,
  defineDelete,
  defineGet,
  defineJSONStream,
  definePatch,
  definePost,
  definePut,
  defineSSE,
  defineWebSocket,
} from 'mock-dash'
import z from 'zod'

// Define all HTTP methods
export const apiSchema = {
  // GET - Retrieve data
  getUsers: defineGet('/users', {
    input: {
      query: {
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      },
    },
    response: z.array(userModel),
  }),

  getUser: defineGet('/users/:id', {
    response: userModel,
  }),

  // POST - Create data
  createUser: definePost('/users', {
    input: {
      json: z.object({
        name: z.string(),
        email: z.email(),
      }),
    },
    response: userModel,
  }),

  // PUT - Replace entire resource
  updateUserFull: definePut('/users/:id', {
    input: {
      json: z.object({
        name: z.string(),
        email: z.email(),
      }),
    },
    response: userModel,
  }),

  // PATCH - Partial update
  updateUserPartial: definePatch('/users/:id', {
    input: {
      json: z.object({
        name: z.string().optional(),
        email: z.email().optional(),
      }),
    },
    response: userModel,
  }),

  // DELETE - Remove resource
  deleteUser: defineDelete('/users/:id', {
    response: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  }),

  // GET - Product list
  getProducts: defineGet('/products', {
    response: z.array(productModel),
  }),

  // POST - Create product
  createProduct: definePost('/products', {
    input: {
      json: z.object({
        name: z.string(),
        price: z.number().positive(),
        stock: z.number().int().min(0),
      }),
    },
    response: productModel,
  }),

  // Server-Sent Events (SSE) - Stream data over HTTP
  streamEvents: defineGet('/events', {
    response: defineSSE({
      message: sseMessageModel,
    }),
  }),

  // JSON Streaming - Stream JSON lines
  streamJsonData: defineGet('/stream/json', {
    response: defineJSONStream(dataStreamModel),
  }),

  // WebSocket - Real-time bidirectional communication
  chatSocket: defineGet('/ws/chat', {
    response: defineWebSocket([chatMessageModel], [chatMessageModel]),
  }),

  // WebSocket - Live metrics
  metricsSocket: defineGet('/ws/metrics', {
    response: defineWebSocket(
      [
        z.object({
          metric: z.string(),
          value: z.number(),
          timestamp: z.string(),
        }),
      ],
      [z.object({ metric: z.string() })],
    ),
  }),
}

export const apiClient = createApiClient({
  apiSchema: apiSchema,
  baseURL: '/api',
})
