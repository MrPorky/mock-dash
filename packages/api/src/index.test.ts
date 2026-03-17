import { Schema } from 'effect';
import { Hono } from 'hono';
import { stream, streamSSE } from 'hono/streaming';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  defineBinaryStream,
  defineDelete,
  defineGet,
  defineJSONStream,
  definePost,
  definePut,
  defineSSEStream,
  defineWebSocketStream,
  type InferOutput,
} from './index.js';

class MockEvent {
  type: string;

  constructor(type: string) {
    this.type = type;
  }
}

class MockMessageEvent extends MockEvent {
  data: string | ArrayBuffer | Blob | ArrayBufferView;

  constructor(
    type: string,
    options: { data?: string | ArrayBuffer | Blob | ArrayBufferView } = {},
  ) {
    super(type);
    this.data = options.data ?? '';
  }
}

class MockCloseEvent extends MockEvent {
  code: number;
  reason: string;

  constructor(type: string, options: { code?: number; reason?: string } = {}) {
    super(type);
    this.code = options.code ?? 1000;
    this.reason = options.reason ?? '';
  }
}

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static lastInstance: MockWebSocket | null = null;

  url: string;
  readyState: number;
  onopen: ((event: MockEvent) => void) | null = null;
  onmessage: ((event: MockMessageEvent) => void) | null = null;
  onerror: ((event: MockEvent) => void) | null = null;
  onclose: ((event: MockCloseEvent) => void) | null = null;
  private listeners: Map<
    string,
    Array<(event: MockEvent | MockMessageEvent | MockCloseEvent) => void>
  > = new Map();

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    MockWebSocket.lastInstance = this;

    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new MockEvent('open'));
    }, 0);
  }

  send(_data: string | ArrayBuffer | Blob) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatchEvent(
        new MockCloseEvent('close', {
          code: code ?? 1000,
          reason: reason ?? '',
        }),
      );
    }, 0);
  }

  addEventListener(
    type: string,
    listener: (event: MockEvent | MockMessageEvent | MockCloseEvent) => void,
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type)?.push(listener);
  }

  dispatchEvent(event: MockEvent | MockMessageEvent | MockCloseEvent) {
    const listeners = this.listeners.get(event.type) || [];

    for (const listener of listeners) {
      listener(event);
    }

    return true;
  }

  simulateMessage(data: string) {
    this.dispatchEvent(new MockMessageEvent('message', { data }));
  }

  simulateError() {
    this.dispatchEvent(new MockEvent('error'));
  }
}

const userSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const taskSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
});

const apiSchema = {
  getUsers: defineGet('/users', {
    input: {
      query: {
        page: Schema.standardSchemaV1(Schema.Number.pipe((val) => val || 1)),
        pageSize: Schema.standardSchemaV1(
          Schema.Number.pipe((val) => val || 10),
        ),
      },
    },
    response: Schema.standardSchemaV1(Schema.Array(userSchema)),
  }),
  addUser: definePost('/users', {
    input: {
      json: Schema.standardSchemaV1(Schema.Struct({ name: Schema.String })),
    },
    response: Schema.standardSchemaV1(userSchema),
  }),
  getUser: defineGet('/users/:id', {
    input: {
      params: {
        id: Schema.standardSchemaV1(Schema.Number),
      },
    },
    response: Schema.standardSchemaV1(userSchema),
  }),
  updateUser: definePut('/users/:id', {
    input: {
      json: Schema.standardSchemaV1(
        Schema.Struct({ name: Schema.String, email: Schema.String }),
      ),
    },
    response: Schema.standardSchemaV1(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        email: Schema.String,
        updatedAt: Schema.String,
      }),
    ),
  }),
  deleteUser: defineDelete('/users/:id', {
    response: Schema.standardSchemaV1(Schema.Void),
  }),
  getUserPosts: defineGet('/users/:id/posts', {
    response: Schema.standardSchemaV1(
      Schema.Array(Schema.Struct({ id: Schema.String, title: Schema.String })),
    ),
  }),
  userPost: definePost('/users/:id/posts', {
    input: {
      json: Schema.standardSchemaV1(
        Schema.Struct({ title: Schema.String, content: Schema.String }),
      ),
    },
    response: Schema.standardSchemaV1(
      Schema.Struct({
        id: Schema.String,
        title: Schema.String,
        content: Schema.String,
      }),
    ),
  }),
  getUserProjectTask: defineGet(
    '/users/:userId/projects/:projectId/tasks/:taskId',
    {
      response: Schema.standardSchemaV1(taskSchema),
    },
  ),
  updateUserProjectTask: definePut(
    '/users/:userId/projects/:projectId/tasks/:taskId',
    {
      input: {
        json: Schema.standardSchemaV1(
          Schema.Struct({ title: Schema.String, description: Schema.String }),
        ),
      },
      response: Schema.standardSchemaV1(
        Schema.Struct({
          id: Schema.String,
          title: Schema.String,
          description: Schema.String,
          updatedAt: Schema.String,
        }),
      ),
    },
  ),
  getUserProjectTaskComments: defineGet(
    '/users/:userId/projects/:projectId/tasks/:taskId/comments',
    {
      response: Schema.standardSchemaV1(
        Schema.Array(
          Schema.Struct({ id: Schema.String, content: Schema.String }),
        ),
      ),
    },
  ),
  addUserProjectTaskComment: definePost(
    '/users/:userId/projects/:projectId/tasks/:taskId/comments',
    {
      input: {
        json: Schema.standardSchemaV1(
          Schema.Struct({ content: Schema.String }),
        ),
      },
      response: Schema.standardSchemaV1(
        Schema.Struct({ id: Schema.String, content: Schema.String }),
      ),
    },
  ),
  getProjectTask: defineGet('/projects/:projectId/tasks/:taskId', {
    response: Schema.standardSchemaV1(taskSchema),
  }),
  getUserTask: defineGet('/users/:userId/tasks/:taskId', {
    response: Schema.standardSchemaV1(taskSchema),
  }),
  userStream: defineGet('/stream/users', {
    response: defineJSONStream(
      Schema.standardSchemaV1(
        Schema.Struct({ id: Schema.String, name: Schema.String }),
      ),
    ),
  }),
  getCustomer: defineGet('/customers/:id', {
    input: {
      params: {
        id: Schema.standardSchemaV1(Schema.Number),
      },
      headers: {
        'x-api-key': Schema.standardSchemaV1(Schema.Literal('secret')),
      },
    },
    response: Schema.standardSchemaV1(userSchema),
  }),
  queryComplex: defineGet('/query-complex', {
    input: {
      query: {
        q: Schema.standardSchemaV1(Schema.String),
        filters: Schema.standardSchemaV1(Schema.Array(Schema.String)),
        page: Schema.standardSchemaV1(Schema.NullishOr(Schema.Number)),
        nested: Schema.standardSchemaV1(
          Schema.NullishOr(
            Schema.Struct({
              category: Schema.String,
              subcategory: Schema.optional(Schema.String),
            }),
          ),
        ),
        defaults: Schema.standardSchemaV1(
          Schema.String.pipe((val) => val || 'default_value'),
        ),
      },
    },
    response: Schema.standardSchemaV1(Schema.Array(userSchema)),
  }),
  authService: definePost('/{auth-service}/{version}/auth-service', {
    input: {
      json: Schema.standardSchemaV1(
        Schema.Struct({
          username: Schema.String,
          password: Schema.String,
        }),
      ),
    },
    response: Schema.standardSchemaV1(
      Schema.Struct({
        token: Schema.String,
      }),
    ),
  }),
  getHealth: defineGet('/health', {
    response: Schema.standardSchemaV1(Schema.Struct({ status: Schema.String })),
  }),
  getVersion: defineGet('/version', {
    response: Schema.standardSchemaV1(
      Schema.Struct({ version: Schema.String }),
    ),
  }),
  getRootStats: defineGet('/stats', {
    response: Schema.standardSchemaV1(Schema.Struct({ uptime: Schema.Number })),
  }),
  getRootInfo: defineGet('/', {
    response: Schema.standardSchemaV1(
      Schema.Struct({ name: Schema.String, description: Schema.String }),
    ),
  }),
  createRootResource: definePost('/', {
    input: {
      json: Schema.standardSchemaV1(
        Schema.Struct({ name: Schema.String, description: Schema.String }),
      ),
    },
    response: Schema.standardSchemaV1(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        description: Schema.String,
      }),
    ),
  }),
  fileDownload: defineGet('/download/file', {
    response: defineBinaryStream('application/octet-stream'),
  }),
  imageStream: defineGet('/download/image', {
    response: defineBinaryStream('image/png'),
  }),
  notificationStream: defineGet('/stream/notifications', {
    response: defineSSEStream({
      notification: Schema.standardSchemaV1(
        Schema.Struct({
          id: Schema.String,
          message: Schema.String,
          timestamp: Schema.String,
        }),
      ),
      heartbeat: Schema.standardSchemaV1(
        Schema.Struct({ status: Schema.String }),
      ),
    }),
  }),
  userEvents: defineGet('/stream/users/:id/events', {
    input: {
      params: {
        id: Schema.standardSchemaV1(Schema.Number),
      },
    },
    response: defineSSEStream({
      userUpdate: Schema.standardSchemaV1(
        Schema.Struct({ id: Schema.String, name: Schema.String }),
      ),
      userActivity: Schema.standardSchemaV1(
        Schema.Struct({
          id: Schema.String,
          activity: Schema.String,
          timestamp: Schema.String,
        }),
      ),
    }),
  }),
  chatStream: defineGet('/stream/chat', {
    input: {
      query: {
        roomId: Schema.standardSchemaV1(Schema.String),
      },
    },
    response: defineWebSocketStream(
      [
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('message'),
            content: Schema.String,
            sender: Schema.String,
            timestamp: Schema.String,
          }),
        ),
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('notification'),
            content: Schema.String,
            timestamp: Schema.String,
          }),
        ),
      ],
      [
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('message'),
            content: Schema.String,
            sender: Schema.String,
          }),
        ),
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('join'),
            username: Schema.String,
          }),
        ),
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('leave'),
            username: Schema.String,
          }),
        ),
      ],
    ),
  }),
  updates: defineGet('/stream/updates/:roomId', {
    input: {
      params: {
        roomId: Schema.standardSchemaV1(Schema.String),
      },
    },
    response: defineWebSocketStream(
      [
        Schema.standardSchemaV1(
          Schema.Struct({
            type: Schema.Literal('update'),
            content: Schema.String,
            timestamp: Schema.String,
          }),
        ),
      ],
      [],
    ),
  }),
};

type BinaryChunk = { type: string; data?: Uint8Array };
type JsonChunk = {
  type: string;
  data?: { id: string; name: string };
  error?: Error;
};
type WebSocketChunk = {
  type: string;
  status?: string;
  data?: unknown;
  error?: Error;
};
type SSEChunk = { type: string; name?: string; data?: unknown };

async function collectBinaryBytes(result: {
  data?: AsyncIterable<BinaryChunk>;
}): Promise<number[]> {
  const bytes: number[] = [];

  if (!result.data) return bytes;

  for await (const chunk of result.data) {
    if (chunk.type === 'binary' && chunk.data) {
      bytes.push(...Array.from(chunk.data));
    }
  }

  return bytes;
}

async function collectJsonStream(result: {
  data?: AsyncIterable<JsonChunk>;
}): Promise<{
  rows: Array<{ id: string; name: string }>;
  errors: Error[];
}> {
  const rows: Array<{ id: string; name: string }> = [];
  const errors: Error[] = [];

  if (!result.data) return { rows, errors };

  for await (const chunk of result.data) {
    if (chunk.type === 'json' && chunk.data) rows.push(chunk.data);
    if (chunk.type === 'error' && chunk.error) errors.push(chunk.error);
  }

  return { rows, errors };
}

async function collectWebSocket(result: {
  data?: AsyncIterable<WebSocketChunk>;
}): Promise<{
  statuses: string[];
  messages: unknown[];
  errors: string[];
}> {
  const statuses: string[] = [];
  const messages: unknown[] = [];
  const errors: string[] = [];

  if (!result.data) return { statuses, messages, errors };

  for await (const chunk of result.data) {
    if (chunk.type === 'status' && chunk.status) statuses.push(chunk.status);
    if (chunk.type === 'message') messages.push(chunk.data);
    if (chunk.type === 'error' && chunk.error) errors.push(chunk.error.message);
  }

  return { statuses, messages, errors };
}

async function collectSSEByEventName<T>(
  result: { data?: AsyncIterable<SSEChunk> },
  eventName: string,
): Promise<T[]> {
  const out: T[] = [];

  if (!result.data) return out;

  for await (const chunk of result.data) {
    if (chunk.type === 'event' && chunk.name === eventName) {
      out.push(chunk.data as T);
    }
  }

  return out;
}

describe('API client', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    MockWebSocket.lastInstance = null;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  describe('HTTP endpoints', () => {
    it('covers all non-streaming endpoints', async () => {
      const app = new Hono()
        .get('/users', () =>
          Response.json([
            { id: 'user_1', name: 'Alice' },
            { id: 'user_2', name: 'Bob' },
          ]),
        )
        .get('/users/1', () => Response.json({ id: '1', name: 'Alice' }))
        .put('/users/1', async (c) => {
          const body = await c.req.json();
          return c.json({
            id: '1',
            name: body.name,
            email: body.email,
            updatedAt: '2026-03-14T12:00:00Z',
          });
        })
        .delete('/users/1', () => new Response(null, { status: 204 }))
        .get('/users/1/posts', () =>
          Response.json([{ id: 'post_1', title: 'First post' }]),
        )
        .post('/users/1/posts', async (c) => {
          const body = await c.req.json();
          return c.json({ id: 'post_2', ...body });
        })
        .get('/users/u1/projects/p1/tasks/t1', () =>
          Response.json({ id: 't1', title: 'Task', description: 'Desc' }),
        )
        .put('/users/u1/projects/p1/tasks/t1', async (c) => {
          const body = await c.req.json();
          return c.json({
            id: 't1',
            ...body,
            updatedAt: '2026-03-14T12:00:00Z',
          });
        })
        .get('/users/u1/projects/p1/tasks/t1/comments', () =>
          Response.json([{ id: 'c1', content: 'Looks good' }]),
        )
        .post('/users/u1/projects/p1/tasks/t1/comments', async (c) => {
          const body = await c.req.json();
          return c.json({ id: 'c2', content: body.content });
        })
        .get('/projects/p1/tasks/t1', () =>
          Response.json({
            id: 't1',
            title: 'Project Task',
            description: 'Desc',
          }),
        )
        .get('/users/u1/tasks/t1', () =>
          Response.json({ id: 't1', title: 'User Task', description: 'Desc' }),
        )
        .get('/customers/44', (c) => {
          if (c.req.header('x-api-key') !== 'secret') {
            return c.json({ error: 'missing key' }, 401);
          }
          return c.json({ id: '44', name: 'Customer' });
        })
        .get('/query-complex', (c) => {
          const query = c.req.query();
          return c.json([
            { id: 'query_1', name: String(query.q ?? 'fallback') },
          ]);
        })
        .post('/authService/v1/auth-service', () =>
          Response.json({ token: 'abc123' }),
        )
        .get('/health', () => Response.json({ status: 'ok' }))
        .get('/version', () => Response.json({ version: '1.0.0' }))
        .get('/stats', () => Response.json({ uptime: 42 }))
        .get('/', () =>
          Response.json({ name: 'Mock API', description: 'Root info' }),
        )
        .post('/', async (c) => {
          const body = await c.req.json();
          return c.json({ id: 'root_1', ...body });
        });

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
        alias: {
          'auth-service': 'authService',
          version: 'v1',
        },
      });

      const users = await client.get('/users', {
        query: { page: 1, pageSize: 10 },
      });
      expect(users.data).toHaveLength(2);

      const user = await client.get('/users/:id', { params: { id: 1 } });
      expect(user.data).toEqual({ id: '1', name: 'Alice' });

      const updatedUser = await client.put('/users/:id', {
        params: { id: 1 },
        json: { name: 'Alice 2', email: 'alice@example.com' },
      });
      expect(updatedUser.data).toMatchObject({ id: '1', name: 'Alice 2' });

      const deletedUser = await client.delete('/users/:id', {
        params: { id: 1 },
      });
      expect(deletedUser.data).toBeUndefined();

      const userPosts = await client.get('/users/:id/posts', {
        params: { id: '1' },
      });
      expect(userPosts.data).toEqual([{ id: 'post_1', title: 'First post' }]);

      const createdPost = await client.post('/users/:id/posts', {
        params: { id: '1' },
        json: { title: 'Hello', content: 'World' },
      });
      expect(createdPost.data).toMatchObject({ id: 'post_2', title: 'Hello' });

      const userProjectTask = await client.get(
        '/users/:userId/projects/:projectId/tasks/:taskId',
        {
          params: { userId: 'u1', projectId: 'p1', taskId: 't1' },
        },
      );
      expect(userProjectTask.data).toMatchObject({ id: 't1' });

      const updatedUserProjectTask = await client.put(
        '/users/:userId/projects/:projectId/tasks/:taskId',
        {
          params: { userId: 'u1', projectId: 'p1', taskId: 't1' },
          json: { title: 'Task 2', description: 'Desc 2' },
        },
      );
      expect(updatedUserProjectTask.data).toMatchObject({ title: 'Task 2' });

      const userProjectTaskComments = await client.get(
        '/users/:userId/projects/:projectId/tasks/:taskId/comments',
        {
          params: { userId: 'u1', projectId: 'p1', taskId: 't1' },
        },
      );
      expect(userProjectTaskComments.data).toHaveLength(1);

      const addedComment = await client.post(
        '/users/:userId/projects/:projectId/tasks/:taskId/comments',
        {
          params: { userId: 'u1', projectId: 'p1', taskId: 't1' },
          json: { content: 'Great work' },
        },
      );
      expect(addedComment.data).toEqual({ id: 'c2', content: 'Great work' });

      const projectTask = await client.get(
        '/projects/:projectId/tasks/:taskId',
        {
          params: { projectId: 'p1', taskId: 't1' },
        },
      );
      expect(projectTask.data).toMatchObject({ id: 't1' });

      const userTask = await client.get('/users/:userId/tasks/:taskId', {
        params: { userId: 'u1', taskId: 't1' },
      });
      expect(userTask.data).toMatchObject({ id: 't1' });

      const customer = await client.get('/customers/:id', {
        params: { id: 44 },
        headers: { 'x-api-key': 'secret' },
      });
      expect(customer.data).toEqual({ id: '44', name: 'Customer' });

      const complex = await client.get('/query-complex', {
        query: {
          q: 'alice',
          filters: ['name'],
          nested: { category: 'users' },
          defaults: 'default_value',
        },
      });
      expect(complex.data).toEqual([{ id: 'query_1', name: 'alice' }]);

      const auth = await client.post('/{auth-service}/{version}/auth-service', {
        json: { username: 'u', password: 'p' },
      });
      expect(auth.data).toEqual({ token: 'abc123' });

      const health = await client.get('/health');
      expect(health.data).toEqual({ status: 'ok' });

      const version = await client.get('/version');
      expect(version.data).toEqual({ version: '1.0.0' });

      const stats = await client.get('/stats');
      expect(stats.data).toEqual({ uptime: 42 });

      const rootInfo = await client.get('/');
      expect(rootInfo.data).toEqual({
        name: 'Mock API',
        description: 'Root info',
      });

      const rootCreate = await client.post('/', {
        json: { name: 'Resource', description: 'Created from test' },
      });
      expect(rootCreate.data).toMatchObject({ id: 'root_1', name: 'Resource' });
    });

    it('supports URL aliases in addition to path aliases', async () => {
      const app = new Hono().post('/v2/auth-service', () =>
        Response.json({ token: 'token-v2' }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
        alias: {
          'auth-service': 'http://localhost',
          version: 'v2',
        },
      });

      const response = await client.post(
        '/{auth-service}/{version}/auth-service',
        {
          json: { username: 'john', password: 'secret' },
        },
      );

      expect(response.data).toEqual({ token: 'token-v2' });
    });

    it('supports AbortSignal for request cancellation', async () => {
      const app = new Hono().get('/users', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return Response.json({ status: 'ok' });
      });

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });

      const abortController = new AbortController();

      const requestPromise = client.get('/users', {
        query: { page: 1, pageSize: 10 },
        signal: abortController.signal,
      });

      abortController.abort();

      // The fetch should throw an AbortError
      const { data, error } = await requestPromise;
      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/abort/i);
    });

    it('automatically injects Content-Type for JSON payloads', async () => {
      let receivedHeaders: Record<string, string> = {};

      const app = new Hono().post('/users', async (c) => {
        receivedHeaders = c.req.header();
        return c.json({ id: '1', name: 'Bob' });
      });

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      await client.post('/users', { json: { name: 'Bob' } });

      // Make sure the client implementation is smart enough to set headers
      expect(receivedHeaders['content-type']).toMatch(/application\/json/i);
    });
  });

  describe('Stream endpoints', () => {
    it('handles binary stream endpoint /download/file', async () => {
      const app = new Hono().get('/download/file', (c) =>
        stream(c, async (s) => {
          await s.write(new Uint8Array([1, 2, 3, 4]));
        }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const file = await client.get('/download/file');
      const fileBytes = await collectBinaryBytes(file);

      expect(fileBytes).toEqual([1, 2, 3, 4]);
    });

    it('handles binary stream endpoint /download/image', async () => {
      const app = new Hono().get(
        '/download/image',
        () =>
          new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { 'Content-Type': 'image/png' },
          }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const image = await client.get('/download/image');
      const imageBytes = await collectBinaryBytes(image);

      expect(imageBytes.slice(0, 4)).toEqual([137, 80, 78, 71]);
    });

    it('handles JSON stream endpoint', async () => {
      const app = new Hono().get('/stream/users', (c) =>
        stream(c, async (s) => {
          await s.writeln(JSON.stringify({ id: '1', name: 'Alice' }));
          await s.writeln(JSON.stringify({ id: '2', name: 'Bob' }));
        }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const result = await client.get('/stream/users');
      const { rows, errors } = await collectJsonStream(result);

      expect(rows).toEqual([
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]);
      expect(errors).toHaveLength(0);
    });

    it('handles SSE endpoint /stream/notifications', async () => {
      const app = new Hono().get('/stream/notifications', (c) =>
        streamSSE(c, async (s) => {
          await s.writeSSE({
            event: 'notification',
            data: JSON.stringify({
              id: 'n1',
              message: 'hello',
              timestamp: '2026-03-14T00:00:00Z',
            }),
          });
          await s.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ status: 'alive' }),
          });
        }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const notifications = await client.get('/stream/notifications');
      const receivedNotifications: InferOutput<
        typeof apiSchema,
        'get',
        '/stream/notifications',
        'notification'
      >[] = await collectSSEByEventName(notifications, 'notification');
      const receivedHeartbeats: InferOutput<
        typeof apiSchema,
        'get',
        '/stream/notifications',
        'heartbeat'
      >[] = await collectSSEByEventName(notifications, 'heartbeat');

      expect(receivedNotifications).toHaveLength(1);
      expect(receivedHeartbeats).toHaveLength(1);
    });

    it('handles SSE endpoint /stream/users/:id/events', async () => {
      const app = new Hono().get('/stream/users/1/events', (c) =>
        streamSSE(c, async (s) => {
          await s.writeSSE({
            event: 'userUpdate',
            data: JSON.stringify({ id: '1', name: 'Alice' }),
          });
          await s.writeSSE({
            event: 'userActivity',
            data: JSON.stringify({
              id: '1',
              activity: 'login',
              timestamp: '2026-03-14T00:01:00Z',
            }),
          });
        }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const userEvents = await client.get('/stream/users/:id/events', {
        params: { id: 1 },
      });
      const names: string[] = [];

      if (userEvents.data) {
        for await (const chunk of userEvents.data) {
          if (chunk.type === 'event') names.push(chunk.name);
        }
      }

      expect(names).toContain('userUpdate');
      expect(names).toContain('userActivity');
    });

    it('handles WebSocket endpoint /stream/chat', async () => {
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
      });
      const chat = await client.get('/stream/chat', {
        query: { roomId: 'general' },
      });
      expect(chat.controller).toBeDefined();

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance;

        if (ws) {
          ws.simulateMessage(
            JSON.stringify({
              type: 'message',
              content: 'hello',
              sender: 'alice',
              timestamp: '2026-03-14T00:00:00Z',
            }),
          );
          ws.simulateMessage(
            JSON.stringify({
              type: 'notification',
              content: 'joined',
              timestamp: '2026-03-14T00:00:01Z',
            }),
          );
          ws.close();
        }
      }, 20);

      const { statuses, messages } = await collectWebSocket(chat);

      expect(statuses).toContain('connecting');
      expect(statuses).toContain('open');
      expect(statuses).toContain('closed');
      expect(messages).toHaveLength(2);
    }, 10000);

    it('handles WebSocket endpoint /stream/updates/:roomId', async () => {
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
      });
      const updates = await client.get('/stream/updates/:roomId', {
        params: { roomId: 'general' },
      });

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance;

        if (ws) {
          ws.simulateMessage(
            JSON.stringify({
              type: 'update',
              content: 'server update',
              timestamp: '2026-03-14T00:00:02Z',
            }),
          );
          ws.close();
        }
      }, 20);

      const { statuses } = await collectWebSocket(updates);

      expect(statuses).toContain('open');
      expect(statuses).toContain('closed');
    }, 10000);
  });

  describe('Failure and validation scenarios', () => {
    it('returns an error when the API path does not exist on server', async () => {
      const app = new Hono();
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });

      const { data, error } = await client.get('/health');

      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/404|not found/i);
    });

    it('returns an error for unsupported client path', async () => {
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
      });

      const { data, error } = await client.get('/nope' as never);
      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/path not found/i);
    });

    it('returns an error when server throws', async () => {
      const app = new Hono().get('/health', () => {
        throw new Error('boom');
      });

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });

      const { data, error } = await client.get('/health');
      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/500|boom|internal/i);
    });

    it('fails request validation for incorrect query/params/json/headers', async () => {
      const fetchSpy = vi.fn(async () => Response.json({ status: 'ok' }));
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: fetchSpy,
      });

      const { data, error } = await client.get('/users', {
        query: { page: 'wrong' as never, pageSize: 10 },
      });
      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/validation/i);

      const { data: data2, error: error2 } = await client.get('/users/:id', {
        params: { id: 'not-a-number' as never },
      });
      await expect(error2).toBeDefined();
      await expect(data2).toBeUndefined();
      expect(error2?.message).toMatch(/validation/i);

      const { data: data3, error: error3 } = await client.put('/users/:id', {
        params: { id: 1 },
        json: { name: 'Alice', email: 123 as never },
      });
      await expect(error3).toBeDefined();
      await expect(data3).toBeUndefined();
      expect(error3?.message).toMatch(/validation/i);

      const { data: data4, error: error4 } = await client.get(
        '/customers/:id',
        {
          params: { id: 1 },
          headers: { 'x-api-key': 'wrong' as never },
        },
      );
      await expect(error4).toBeDefined();
      await expect(data4).toBeUndefined();
      expect(error4?.message).toMatch(/validation/i);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails response validation when server returns invalid shape', async () => {
      const app = new Hono().get('/version', () =>
        Response.json({ version: 123 }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });

      const { data, error } = await client.get('/version');
      await expect(error).toBeDefined();
      await expect(data).toBeUndefined();
      expect(error?.message).toMatch(/validation/i);
    });

    it('emits parse/validation errors for malformed stream payloads', async () => {
      const app = new Hono().get('/stream/users', (c) =>
        stream(c, async (s) => {
          await s.writeln('not-json');
          await s.writeln(JSON.stringify({ id: 'ok', name: 'User' }));
          await s.writeln(JSON.stringify({ id: 'broken' }));
        }),
      );

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      });
      const result = await client.get('/stream/users');
      const { rows, errors } = await collectJsonStream(result);

      expect(rows).toHaveLength(1);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('emits websocket parse errors for invalid incoming message payload', async () => {
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
      });
      const result = await client.get('/stream/chat', {
        query: { roomId: 'broken-room' },
      });

      const errors: string[] = [];

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance;

        if (ws) {
          ws.simulateMessage(JSON.stringify({ invalid: 'shape' }));
          ws.simulateError();
          ws.close();
        }
      }, 20);

      if (result.data) {
        for await (const chunk of result.data) {
          if (chunk.type === 'error') errors.push(chunk.error.message);
        }
      }

      expect(errors.length).toBeGreaterThan(0);
    }, 10000);

    it('validates and sends WebSocket messages from the client', async () => {
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
      });
      const chat = await client.get('/stream/chat', {
        query: { roomId: 'general' },
      });

      const ws = MockWebSocket.lastInstance;

      expect(ws).toBeTruthy();
      if (!ws) return;

      const sendSpy = vi.spyOn(ws, 'send');

      expect(chat.controller).toBeDefined();
      if (!chat.controller) return;

      // 1. Test successful, validated send
      chat.controller.send({ type: 'join', username: 'Alice' });
      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'join', username: 'Alice' }),
      );

      // 2. Test outgoing validation failure (Standard Schema should block this)
      expect(() => {
        chat.controller.send({ type: 'join', wrong_key: 'Bob' } as never);
      }).toThrow(/Validation Error/i);

      // 3. Test explicit client-side disconnect
      const closeSpy = vi.spyOn(ws, 'close');
      chat.controller.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
