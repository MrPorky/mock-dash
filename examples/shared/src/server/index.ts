import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { createMockServer } from 'mock-dash'
import { zocker } from 'zocker'
import { apiSchema } from '../schemas'

// Mock data storage
const users = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date().toISOString(),
  },
]

const products = [
  { id: '1', name: 'Laptop', price: 999.99, stock: 10 },
  { id: '2', name: 'Mouse', price: 29.99, stock: 50 },
  { id: '3', name: 'Keyboard', price: 79.99, stock: 25 },
]

// Define mock responses for GET endpoints
apiSchema.getUsers.defineMock((ctx) => {
  const page = ctx.inputs.query?.page || 1
  const limit = ctx.inputs.query?.limit || 10
  return users.slice((page - 1) * limit, page * limit)
})

apiSchema.getUser.defineMock((ctx) => {
  const user = users.find((u) => u.id === ctx.inputs.param.id)
  if (!user) throw new Error('User not found')
  return user
})

// Define mock responses for POST (Create)
apiSchema.createUser.defineMock((ctx) => {
  const newUser = {
    id: String(Math.random()),
    name: ctx.inputs.json.name,
    email: ctx.inputs.json.email,
    createdAt: new Date().toISOString(),
  }
  users.push(newUser)
  return newUser
})

// Define mock responses for PUT (Full update)
apiSchema.updateUserFull.defineMock((ctx) => {
  const user = users.find((u) => u.id === ctx.inputs.param.id)
  if (!user) throw new Error('User not found')
  user.name = ctx.inputs.json.name
  user.email = ctx.inputs.json.email
  return user
})

// Define mock responses for PATCH (Partial update)
apiSchema.updateUserPartial.defineMock((ctx) => {
  const user = users.find((u) => u.id === ctx.inputs.param.id)
  if (!user) throw new Error('User not found')
  if (ctx.inputs.json.name !== undefined) user.name = ctx.inputs.json.name
  if (ctx.inputs.json.email !== undefined) user.email = ctx.inputs.json.email
  return user
})

// Define mock responses for DELETE
apiSchema.deleteUser.defineMock((ctx) => {
  const index = users.findIndex((u) => u.id === ctx.inputs.param.id)
  if (index === -1) throw new Error('User not found')
  users.splice(index, 1)
  return { success: true, message: `User ${ctx.inputs.param.id} deleted` }
})

// Products mock responses
apiSchema.getProducts.defineMock(() => products)

apiSchema.createProduct.defineMock((ctx) => {
  const newProduct = {
    id: String(Math.random()),
    name: ctx.inputs.json.name,
    price: ctx.inputs.json.price,
    stock: ctx.inputs.json.stock,
  }
  products.push(newProduct)
  return newProduct
})

// Server-Sent Events (SSE) - Stream data
apiSchema.streamEvents.defineMock(async ({ stream }) => {
  for (let i = 0; i < 5; i++) {
    await stream.write({
      event: 'message',
      data: {
        type: ['update', 'notification', 'alert'][
          Math.floor(Math.random() * 3)
        ] as 'update' | 'notification' | 'alert',
        data: `This is message ${i + 1}`,
        timestamp: new Date().toISOString(),
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
})

// JSON Streaming
apiSchema.streamJsonData.defineMock(async ({ stream }) => {
  for (let i = 0; i < 10; i++) {
    stream.writeln({
      index: i,
      value: `Data chunk ${i}`,
      timestamp: new Date().toISOString(),
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
})

// WebSocket - Chat
apiSchema.chatSocket.defineMock({
  async onMessage(evt, ws) {
    await new Promise((resolve) => setTimeout(resolve, 500))

    ws.send({
      id: String(Math.random()),
      user: 'Server',
      message: `Echo: ${evt.data.message}`,
      timestamp: new Date().toISOString(),
    })
  },
})

// WebSocket - Metrics
apiSchema.metricsSocket.defineMock(() => {
  let sendMetrics: ReturnType<typeof setTimeout>
  return {
    onOpen(_evt, ws) {
      sendMetrics = setInterval(() => {
        ws.send({
          metric: 'cpu_usage',
          value: Math.random() * 100,
          timestamp: new Date().toISOString(),
        })
      }, 1000)
    },
    onClose() {
      clearInterval(sendMetrics)
    },
  }
})

const { app, injectWebSocket } = createMockServer(apiSchema, {
  // @ts-expect-error zocker types are not aligned with zod types
  zodToMock: (s) => zocker(s).generate(),
  base: '/api',
  createNodeWebSocket,
})

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001
const server = serve({
  fetch: app.fetch,
  port,
})
injectWebSocket?.(server)

console.log(`🚀 Mock server running at http://localhost:${port}`)
