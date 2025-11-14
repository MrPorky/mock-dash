<div align="center">

# MockDash

**A TypeScript library that lets you define your API schema once and get both a type-safe API client for your frontend and a Hono-based mock server for development.**

[![npm version](https://badge.fury.io/js/mock-dash.svg)](https://badge.fury.io/js/mock-dash)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## Table of Contents

- [Why MockDash?](#why-mockdash)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Usage](#usage)
  - [Define Endpoints](#define-endpoints)
    - [HTTP Methods](#http-methods)
    - [Streams](#streams)
    - [WebSockets](#websockets)
    - [Options](#options)
  - [Generate Type-Safe Client](#generate-type-safe-client)
    - [Client Methods](#client-methods)
    - [Form Data Parsing](#form-data-parsing)
    - [Error Handling](#error-handling)
    - [Interceptors](#interceptors)
  - [Create Mock Server](#create-mock-server)
    - [Define Mock Responses](#define-mock-responses)
    - [Start Server](#start-server)
    - [WebSocket Support](#websocket-support)
  - [Utilities](#utilities)
  - [CLI Tool](#cli-tool)
    - [Generate specs from OpenAPI](#generate-specs-from-openapi)
- [Contributing](#contributing)
- [License](#license)

## Why MockDash?

- **Single Source of Truth**: Define your API schema once using Zod
- **Type-Safe Client**: Get a fully typed API client for your frontend
- **Mock Server**: Automatically generate a Hono mock server for development
- **Frontend Independence**: Work on frontend features while waiting for backend implementation
- **Zero Configuration**: Works out of the box with sensible defaults

## Installation

```bash
npm install mock-dash zod
npm install --save-dev hono
# or
pnpm add mock-dash zod
pnpm add -D hono
```

MockDash has minimal dependencies:
- **zod** (peer dependency) - For schema validation and type inference
- **hono** (dev dependency) - For mock server generation
- **@hono/zod-validator** - Built-in for request validation

## Quick Start

Here's a simple example to get you started:

```typescript
import z from 'zod'
import { defineGet, definePost, createApiClient, createMockServer } from 'mock-dash'

// 1. Define your API schema once
const apiSchema = {
  getUser: defineGet('/users/:id', {
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
  }),
  createUser: definePost('/users', {
    input: {
      json: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    },
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
  }),
}

// 2. Create a type-safe API client
const client = createApiClient({
  apiSchema,
  baseURL: 'https://api.example.com',
})

// 3. Use the client with full type safety
const response = await client.users.id('123').get()
if (response.data) {
  console.log(response.data.name) // TypeScript knows this is a string
}

// 4. Create a mock server for development
apiSchema.getUser.defineMock((ctx) => ({
  id: ctx.inputs.param.id,
  name: 'John Doe',
  email: 'john@example.com',
}))

apiSchema.createUser.defineMock((ctx) => ({
  id: 'new-user-123',
  name: ctx.inputs.json.name,
  email: ctx.inputs.json.email,
  createdAt: new Date().toISOString(),
}))

const mockServer = createMockServer(apiSchema)
```

## Features

- ✅ **Type-Safe API Client**: Automatically generated client with full TypeScript support
- ✅ **Mock Server**: Hono-based mock server for development and testing
- ✅ **Zod Validation**: Request/response validation using Zod schemas
- ✅ **Path Parameters**: Support for dynamic URL segments (`:id`, `:slug`, etc.)
- ✅ **Query Parameters**: Type-safe query string handling
- ✅ **Request Bodies**: JSON, form data, and custom content types
- ✅ **Stream Support**: Server-Sent Events (SSE) and JSON streaming
- ✅ **WebSocket Support**: Real-time bidirectional communication
- ✅ **Error Handling**: Structured error types for different failure modes
- ✅ **Interceptors**: Request/response transformation and middleware
- ✅ **OpenAPI Generation**: Generate schemas from existing OpenAPI specs
- ✅ **Path Aliases**: Support for API versioning and prefixes

## Usage

### Define Endpoints

#### HTTP Methods

MockDash supports all standard HTTP methods with type-safe definitions:

```typescript
import z from 'zod'
import { defineGet, definePost, definePut, definePatch, defineDelete } from 'mock-dash'

// GET endpoint with query parameters
const getUsers = defineGet('/users', {
  input: {
    query: {
      page: z.string().optional(),
      limit: z.coerce.number().optional(),
      search: z.string().optional(),
    },
  },
  response: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  })),
})

// POST endpoint with JSON body
const createUser = definePost('/users', {
  input: {
    json: z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().min(18),
    }),
  },
  response: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    age: z.number(),
    createdAt: z.string(),
  }),
})

// PUT endpoint with path parameters
const updateUser = definePut('/users/:id', {
  input: {
    json: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
    }),
  },
  response: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    updatedAt: z.string(),
  }),
})

// DELETE endpoint
const deleteUser = defineDelete('/users/:id', {
  response: z.void(),
})
```

#### Streams

MockDash supports different types of streaming responses:

```typescript
import { defineSSE, defineJSONStream, defineBinaryStream } from 'mock-dash'

// Server-Sent Events
const notifications = defineGet('/notifications', {
  response: defineSSE({
    message: z.object({
      type: z.literal('message'),
      content: z.string(),
    }),
    alert: z.object({
      type: z.literal('alert'),
      level: z.enum(['info', 'warning', 'error']),
      message: z.string(),
    }),
  }),
})

// JSON streaming
const streamData = defineGet('/stream', {
  response: defineJSONStream(
    z.object({
      id: z.string(),
      timestamp: z.number(),
      data: z.any(),
    })
  ),
})

// Binary streaming
const downloadFile = defineGet('/files/:id', {
  response: defineBinaryStream('application/pdf'),
})
```

#### WebSockets

Define real-time WebSocket endpoints with typed message schemas:

```typescript
import { defineWebSocket } from 'mock-dash'

const chatEndpoint = defineGet('/chat/:roomId', {
  response: defineWebSocket(
    // Server-to-client messages
    [
      z.object({ type: z.literal('message'), text: z.string(), user: z.string() }),
      z.object({ type: z.literal('userJoined'), user: z.string() }),
      z.object({ type: z.literal('userLeft'), user: z.string() }),
    ],
    // Client-to-server messages
    [
      z.object({ type: z.literal('sendMessage'), text: z.string() }),
      z.object({ type: z.literal('join'), user: z.string() }),
    ]
  ),
})
```

#### Options

Configure endpoints with additional options:

```typescript
// Path aliases for API versioning
const getUser = defineGet('{api}/users/:id', {
  response: userSchema,
  options: {
    alias: { api: '/api/v1' },
  },
})

// Custom headers or middleware configuration
const secureEndpoint = defineGet('/admin/users', {
  response: userListSchema,
  options: {
    // Custom options can be used by your middleware
    requiresAuth: true,
  },
})
```

### Generate Type-Safe Client

#### Client Methods

The API client provides a fluent interface matching your endpoint paths:

```typescript
const client = createApiClient({
  apiSchema,
  baseURL: 'https://api.example.com',
  // Optional: custom fetch implementation
  fetch: customFetch,
})

// Simple GET request
const users = await client.users.get({ query: { limit: 10 } })

// GET with path parameters
const user = await client.users.id('123').get()

// POST with JSON body
const newUser = await client.users.post({
  json: { name: 'John', email: 'john@example.com' },
})

// Nested paths
const userPosts = await client.users.id('123').posts.get()

// Complex nested paths with multiple parameters
const comment = await client.users
  .userId('123')
  .posts.postId('456')
  .comments.commentId('789')
  .get()
```

#### orThrow Methods
For scenarios where you want to throw errors directly instead of handling them in the response object, use the `orThrow` method:

```typescript
try {
  const user = await client.users.id('123').get.orThrow()
  console.log(user.name)
} catch (error) {
  // Handle errors directly
  console.error('Error fetching user:', error)
}
```

#### Form Data Parsing

For endpoints that accept JSON input, MockDash provides a `safeParseForm` utility method to validate and parse FormData into the expected schema format:

```typescript
// Define an endpoint that accepts JSON input
const createUser = definePost('/users', {
  input: {
    json: z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.coerce.number(), // Will be coerced from string
    }),
  },
  response: userSchema,
})

// Parse FormData on the client side
const formData = new FormData()
formData.append('name', 'John Doe')
formData.append('email', 'john@example.com')
formData.append('age', '25') // String that will be coerced to number

// Validate and parse the form data
const parseResult = client.users.post.safeParseForm(formData)

if (parseResult.success) {
  // parseResult.data is fully typed and validated
  console.log(parseResult.data.name) // "John Doe"
  console.log(parseResult.data.age)  // 25 (number)
  
  // Use the parsed data in your API call
  const response = await client.users.post({ json: parseResult.data })
} else {
  // Handle validation errors
  console.error('Form validation failed:', parseResult.error)
}

// Disable automatic type coercion if needed
const strictParseResult = client.users.post.safeParseForm(formData, false)
```

The `safeParseForm` method:
- Only available on endpoints with `json` input schemas (not available for streams or WebSockets)
- Automatically coerces string form values to appropriate types (unless `autoCoerce` is false)
- Returns a result object with `success` boolean and either `data` or `error`
- Provides full TypeScript type safety for the parsed data
- Uses the same validation schema as the endpoint's JSON input

#### Error Handling

MockDash provides structured error types for comprehensive error handling:

```typescript
import { isApiError, isNetworkError, isValidationError } from 'mock-dash'

const response = await client.users.id('123').get()

if (response.error) {
  if (isApiError(response.error)) {
    // HTTP error (4xx, 5xx)
    console.error(`API Error ${response.error.status}:`, response.error.message)
  } else if (isNetworkError(response.error)) {
    // Network connectivity issues
    console.error('Network Error:', response.error.message)
  } else if (isValidationError(response.error)) {
    // Schema validation failures
    console.error('Validation Error:', response.error.getFieldErrors())
  }
} else {
  // Success - response.data is fully typed
  console.log('User:', response.data)
}
```

#### Interceptors

Add global request/response interceptors for authentication, logging, etc.:

```typescript
// Request interceptor for authentication
client.interceptors.request.use((context, options) => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${getAuthToken()}`,
  },
}))

// Response interceptor for logging
client.interceptors.response.use((context, response) => {
  console.log(`${context.method} ${context.url} - ${response.status}`)
  return response
})

// Local interceptors for specific requests
await client.users.get({
  transformRequest: (context, options) => ({
    ...options,
    headers: { ...options.headers, 'X-Custom': 'value' },
  }),
  transformResponse: (context, response) => {
    // Process response
    return response
  },
})
```

### Create Mock Server

#### Define Mock Responses

Create realistic mock responses for development and testing:

```typescript
// Static mock responses
apiSchema.getUser.defineMock({
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
})

// Dynamic mock responses with access to request context
apiSchema.getUser.defineMock((ctx) => ({
  id: ctx.inputs.param.id,
  name: 'Dynamic User',
  email: `user${ctx.inputs.param.id}@example.com`,
}))

// Mock with query parameters
apiSchema.searchUsers.defineMock((ctx) => ({
  users: [
    {
      id: '1',
      name: `Search result for: ${ctx.inputs.query.q}`,
      email: 'user1@example.com',
    },
  ],
  total: 1,
}))

// Mock with JSON body
apiSchema.createUser.defineMock((ctx) => ({
  id: Math.random().toString(36),
  name: ctx.inputs.json.name,
  email: ctx.inputs.json.email,
  createdAt: new Date().toISOString(),
}))

// Async mock functions
apiSchema.getUser.defineMock(async (ctx) => {
  // Simulate database lookup
  await new Promise(resolve => setTimeout(resolve, 100))
  return {
    id: ctx.inputs.param.id,
    name: 'Async User',
    email: 'async@example.com',
  }
})

// Access to Hono context for advanced scenarios
apiSchema.getUser.defineMock((ctx) => ({
  id: ctx.inputs.param.id,
  name: 'User',
  customHeader: ctx.honoContext.req.header('X-Custom') || 'none',
}))
```

#### Start Server

Create and configure your mock server:

```typescript
import { createMockServer } from 'mock-dash'

// Basic server
const app = createMockServer(apiSchema)

// Server with custom options
const app = createMockServer(apiSchema, {
  // Base path for all endpoints
  base: '/api/v1',
  
  // Custom fetch function for network requests
  fetch: customFetch,
  
  // Automatic mock generation from Zod schemas
  zodToMock: (schema) => {
    // Custom logic to generate mock data from Zod schema
    if (schema instanceof z.ZodString) return 'mock-string'
    if (schema instanceof z.ZodNumber) return 42
    // ... handle other types
  },
  
  // Custom middleware
  addMiddleware: (app) => {
    app.use('*', async (c, next) => {
      // Add CORS headers
      c.header('Access-Control-Allow-Origin', '*')
      await next()
    })
  },
})

// Start the server (if using in Node.js)
import { serve } from '@hono/node-server'
serve({ fetch: app.fetch, port: 3000 })
```

#### WebSocket Support

For WebSocket endpoints, provide the `upgradeWebSocket` function (see [hono](https://hono.dev/docs/helpers/websocket)):

```typescript
import { createMockServer } from 'mock-dash'

// Define WebSocket mocks
apiSchema.chat.defineMock((ctx) => ({
  onOpen: () => {
    console.log(`User joined room ${ctx.inputs.param.roomId}`)
  },
  onMessage: (ws, message) => {
    // Echo messages back to all clients
    ws.send({
      type: 'message',
      text: message.text,
      user: 'mock-user',
    })
  },
  onClose: () => {
    console.log('User left')
  },
}))

const app = createMockServer(apiSchema, {
  // Provide WebSocket upgrade function (depends on your runtime)
  upgradeWebSocket: (handler) => (c) => {
    // Implementation depends on your WebSocket library
    // This is just an example structure
    return c.upgradeWebSocket(handler)
  },
})
```

### Utilities

MockDash includes several utility functions for common tasks:

```typescript
import { MockError } from 'mock-dash'

// Throw specific HTTP errors from mock functions
apiSchema.getUser.defineMock((ctx) => {
  if (ctx.inputs.param.id === 'not-found') {
    throw new MockError('User not found', 404)
  }
  
  return { id: ctx.inputs.param.id, name: 'Found User' }
})
```

### CLI Tool

MockDash provides a CLI tool to generate schemas from OpenAPI specifications.

#### Generate specs from OpenAPI

Convert existing OpenAPI specifications to MockDash schemas:

```bash
# Generate from OpenAPI JSON
npx mock-dash generate ./api-spec.json --out ./src/api-schema.ts

# Generate from OpenAPI YAML  
npx mock-dash generate ./api-spec.yaml --out ./src/api-schema.ts

# Strip prefixes and use aliases for API versioning
npx mock-dash generate ./api-spec.json \
  --out ./src/api-schema.ts \
  --prefix "/api/v1,/api/v2"

# Make all properties required by default
npx mock-dash generate ./api-spec.json \
  --out ./src/api-schema.ts \
  --properties-required-by-default

# Short form options
npx mock-dash generate ./api-spec.json -o ./schema.ts -p "/api/v1" -prbd
```

The generated file will export:

```typescript
// Component schemas
export const userModel = z.object({ /* ... */ })
export const productModel = z.object({ /* ... */ })

// Endpoint definitions
export const getUsersId = defineGet('/users/:id', {
  response: userModel,
})

export const postUsers = definePost('/users', {
  input: { json: userModel },
  response: userModel,
})

// With prefix aliases
export const getApiUsers = defineGet('{api}/users', {
  response: z.array(userModel),
  options: { alias: { api: '/api/v1' } },
})
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/MrPorky/mock-dash.git
cd mock-dash
pnpm install
pnpm test
```

## License

MIT © [MrPorky](https://github.com/MrPorky)
