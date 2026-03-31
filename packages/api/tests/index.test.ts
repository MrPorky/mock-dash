import { Hono } from "hono";

import { stream, streamSSE } from "hono/streaming";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import z from "zod";

import {
  defineDelete,
  defineGet,
  definePatch,
  definePost,
  definePut,
  defineBinaryStream,
  defineJSONStream,
  defineSSE,
  defineWebSocket,
  ApiError,
  NetworkError,
  ValidationError,
  createApiClient,
} from "../src/index.ts";

// --- WEB SOCKET MOCKS ---

class MockEvent {
  constructor(public type: string) {}
}

class MockMessageEvent extends MockEvent {
  public data: any;

  constructor(type: string, options: { data?: any } = {}) {
    super(type);

    this.data = options.data ?? "";
  }
}

class MockCloseEvent extends MockEvent {
  public code: number;

  public reason: string;

  constructor(type: string, options: { code?: number; reason?: string } = {}) {
    super(type);

    this.code = options.code ?? 1000;

    this.reason = options.reason ?? "";
  }
}

class MockWebSocket {
  static lastInstance: MockWebSocket | null = null;

  readyState = 0;

  private listeners: Map<string, Array<(e: any) => void>> = new Map();

  constructor(public url: string) {
    MockWebSocket.lastInstance = this;

    setTimeout(() => {
      this.readyState = 1;

      this.dispatchEvent(new MockEvent("open"));
    }, 0);
  }

  send(_data: string) {
    if (this.readyState !== 1) throw new Error("WebSocket is not open");
  }

  close(code?: number, reason?: string) {
    this.readyState = 2;

    setTimeout(() => {
      this.readyState = 3;

      this.dispatchEvent(new MockCloseEvent("close", { code, reason }));
    }, 0);
  }

  addEventListener(type: string, listener: any) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);

    this.listeners.get(type)?.push(listener);
  }

  dispatchEvent(event: any) {
    this.listeners.get(event.type)?.forEach((l) => l(event));

    return true;
  }

  simulateMessage(data: string) {
    this.dispatchEvent(new MockMessageEvent("message", { data }));
  }

  simulateError() {
    this.dispatchEvent(new MockEvent("error"));
  }
}

// --- GLOBAL API SCHEMA ---

const globalApiSchema = {
  // --- Existing CRUD ---

  getUser: defineGet("/{api}/users/:id", {
    response: z.object({ id: z.string(), name: z.string() }),
  }),

  listUsers: defineGet("/users", {
    response: z.array(z.object({ id: z.string(), name: z.string() })),
  }),

  createUser: definePost("/users", {
    input: { json: z.object({ name: z.string(), email: z.string() }) },

    response: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),

  updateUser: definePut("/users/:id", {
    input: { json: z.object({ name: z.string(), email: z.string().email() }) },

    response: z.object({ id: z.string(), name: z.string(), updatedAt: z.string() }),
  }),

  patchUser: definePatch("/users/:id", {
    input: { json: z.object({ name: z.string().optional() }) },

    response: z.object({ id: z.string(), name: z.string() }),
  }),

  deleteUser: defineDelete("/users/:id", { response: z.void() }),

  // --- New CRUD endpoints ---

  deleteUserConfirm: defineDelete("/users/:id/confirm", {
    response: z.object({ deleted: z.boolean(), deletedAt: z.string() }),
  }),

  uploadAvatar: definePost("/users/:id/avatar", {
    input: { form: { file: z.string(), description: z.string().optional() } },

    response: z.object({ avatarUrl: z.string() }),
  }),

  createDefaultUser: definePost("/users/default", {
    input: {
      json: z.object({
        name: z.string(),

        role: z.string().default("user").optional(),
      }),
    },

    response: z.object({ name: z.string(), role: z.string() }),
  }),

  submitForm: definePost("/form", {
    input: {
      form: {
        field: z.string(),

        optionalField: z.string().default("default-value").optional(),
      },
    },

    response: z.object({ field: z.string(), optionalField: z.string() }),
  }),

  postVoid: definePost("/void-post", {
    input: { json: z.object({ field: z.string() }) },

    response: z.void(),
  }),

  submitNestedForm: definePost("/form/nested", {
    input: {
      form: {
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      },
    },

    response: z.object({
      name: z.string(),
      address: z.object({ street: z.string(), city: z.string() }),
    }),
  }),

  submitArrayForm: definePost("/form/array", {
    input: {
      form: {
        title: z.string(),
        items: z.array(z.object({ name: z.string(), qty: z.string() })),
      },
    },

    response: z.object({
      title: z.string(),
      items: z.array(z.object({ name: z.string(), qty: z.string() })),
    }),
  }),

  submitDeepNestedForm: definePost("/form/deep", {
    input: {
      form: {
        user: z.object({
          name: z.string(),
          address: z.object({
            street: z.string(),
            city: z.string(),
          }),
        }),
      },
    },

    response: z.object({
      user: z.object({
        name: z.string(),
        address: z.object({ street: z.string(), city: z.string() }),
      }),
    }),
  }),

  // --- GET extended ---

  searchUsers: defineGet("/users/search", {
    input: {
      query: {
        q: z.string(),

        page: z.string().optional(),

        limit: z.string().optional(),
      },
    },

    response: z.object({
      users: z.array(z.object({ id: z.string(), name: z.string() })),

      total: z.number(),
    }),
  }),

  getUserPost: defineGet("/users/:userId/posts/:postId", {
    response: z.object({ id: z.string(), title: z.string(), userId: z.string() }),
  }),

  getCommentReply: defineGet("/users/:userId/posts/:postId/comments/:commentId/replies/:replyId", {
    response: z.object({ id: z.string(), content: z.string(), commentId: z.string() }),
  }),

  getText: defineGet("/api/text", { response: z.string() }),

  getValidation: defineGet("/validation", {
    response: z.object({ id: z.string(), age: z.number() }),
  }),

  // --- Sub-resources under /users/:id ---

  getUserInfo: defineGet("/users/:id/info", {
    response: z.object({
      id: z.string(),

      profile: z.object({ bio: z.string(), location: z.string() }),
    }),
  }),

  getUserMetrics: defineGet("/users/:id/metrics", {
    response: z.object({ userId: z.string(), loginCount: z.number(), lastLogin: z.string() }),
  }),

  getUserSettings: defineGet("/users/:id/settings", {
    response: z.object({ userId: z.string(), theme: z.string() }),
  }),

  getUserProfile: defineGet("/users/:id/profile", {
    response: z.object({ userId: z.string(), bio: z.string() }),
  }),

  updateUserInfo: definePut("/users/:id/info", {
    input: {
      json: z.object({ bio: z.string().optional(), location: z.string().optional() }),
    },

    response: z.object({
      id: z.string(),

      profile: z.object({ bio: z.string(), location: z.string() }),

      updatedAt: z.string(),
    }),
  }),

  // --- Root path ---

  getRoot: defineGet("/", {
    response: z.object({ message: z.string(), service: z.string() }),
  }),

  // --- Streams ---

  fileDownload: defineGet("/download/file", {
    response: defineBinaryStream("application/octet-stream"),
  }),

  imageStream: defineGet("/download/image", {
    response: defineBinaryStream("image/png"),
  }),

  userStream: defineGet("/stream/users", {
    response: defineJSONStream(z.object({ id: z.string(), name: z.string() })),
  }),

  numberStream: defineGet("/stream/numbers", {
    response: defineJSONStream(z.object({ value: z.number() })),
  }),

  slowStream: defineGet("/stream/slow", {
    response: defineJSONStream(z.object({ seq: z.number() })),
  }),

  // --- SSE ---

  notificationStream: defineGet("/events/notifications", {
    input: { query: { userId: z.string() } },

    response: defineSSE({
      notification: z.object({ id: z.string(), message: z.string() }),
    }),
  }),

  userEvents: defineGet("/users/:userId/events", {
    input: { query: { since: z.string().optional() } },

    response: defineSSE({
      userUpdate: z.object({ userId: z.string(), field: z.string(), newValue: z.string() }),

      userAction: z.object({
        userId: z.string(),

        action: z.string(),

        timestamp: z.string(),
      }),
    }),
  }),

  sseErrors: defineGet("/events/errors", {
    response: defineSSE({
      validEvent: z.object({ message: z.string() }),
    }),
  }),

  multiEvents: defineGet("/multi-events", {
    response: defineSSE({
      typeA: z.object({ type: z.literal("A"), data: z.string() }),

      typeB: z.object({ type: z.literal("B"), value: z.number() }),

      typeC: z.object({ type: z.literal("C"), items: z.array(z.string()) }),
    }),
  }),

  secureEvents: defineGet("/secure/events", {
    input: { query: { token: z.string() } },

    response: defineSSE({
      secureMessage: z.object({ encrypted: z.string() }),
    }),
  }),

  // --- WebSocket ---

  chatStream: defineGet("/chat", {
    response: defineWebSocket(
      [z.object({ id: z.string(), text: z.string() })],

      [z.object({ text: z.string() })],
    ),
  }),

  wsUpdates: defineGet("/updates", {
    input: { query: { token: z.string().optional(), room: z.string().optional() } },

    response: defineWebSocket([z.object({ value: z.string() })], [z.object({ text: z.string() })]),
  }),

  wsUserUpdates: defineGet("/users/:userId/updates", {
    response: defineWebSocket([z.object({ field: z.string(), value: z.string() })], []),
  }),

  // --- Alias endpoints ---

  multiAliasResource: defineGet("/{service}/{version}/resources/:id", {
    response: z.object({ id: z.string(), service: z.string(), version: z.string() }),
  }),

  aliasSearch: defineGet("/{api}/users/search", {
    input: { query: { q: z.string(), limit: z.string().optional() } },

    response: z.array(z.object({ id: z.string(), name: z.string() })),
  }),

  aliasPost: definePost("/{api}/users", {
    input: { json: z.object({ name: z.string(), email: z.string() }) },

    response: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),

  aliasHealth: defineGet("/{root}/health", {
    response: z.object({ status: z.string() }),
  }),

  aliasUpdateUser: definePut("/{api}/users/:id", {
    input: { json: z.object({ name: z.string() }) },

    response: z.object({ id: z.string(), name: z.string(), updated: z.boolean() }),
  }),

  // --- Error testing ---

  brokenJson: defineGet("/broken", { response: z.object({ data: z.string() }) }),
};

// --- GLOBAL HONO APP ---

const app = new Hono();

// --- CRUD routes ---

// Static routes must be registered before parameterized ones in Hono
app.get("/api/v1/users/search", (c) => c.json([{ id: "1", name: "John Doe" }]));

app.get("/api/v1/users/:id", (c) => c.json({ id: c.req.param("id"), name: "John Doe" }));

app.get("/users", (c) => c.json([{ id: "1", name: "John" }]));

app.post("/users", async (c) => {
  const body = await c.req.json();

  return c.json({ id: "new", ...body });
});

app.put("/users/:id", (c) =>
  c.json({ id: c.req.param("id"), name: "Updated", updatedAt: "2023-01-01" }),
);

app.patch("/users/:id", (c) => c.json({ id: c.req.param("id"), name: "Patched Name" }));

app.delete("/users/:id", (c) => c.body(null, 204));

app.delete("/users/:id/confirm", (c) =>
  c.json({ deleted: true, deletedAt: "2023-01-01T12:00:00Z" }),
);

app.post("/users/:id/avatar", (c) => c.json({ avatarUrl: "https://example.com/avatar.jpg" }));

app.post("/users/default", async (c) => {
  const body = await c.req.json();

  return c.json({ name: body.name, role: body.role ?? "user" });
});

app.post("/form", async (c) => {
  const body = await c.req.parseBody();

  return c.json({ field: body.field, optionalField: body.optionalField ?? "default-value" });
});

app.post("/void-post", (c) => c.body(null, 200));

app.post("/form/nested", async (c) => {
  const body = await c.req.parseBody({ dot: true });

  return c.json(body);
});

app.post("/form/array", async (c) => {
  const body = await c.req.parseBody({ all: true, dot: true });

  // With { dot: true }, Hono expands "items[0].name" into { "items[0]": { name: ... } }
  const items: Array<{ name: string; qty: string }> = [];
  let i = 0;
  while (body[`items[${i}]`]) {
    const item = body[`items[${i}]`] as Record<string, string>;
    items.push({
      name: String(item.name ?? ""),
      qty: String(item.qty ?? ""),
    });
    i++;
  }

  return c.json({ title: body.title, items });
});

app.post("/form/deep", async (c) => {
  const body = await c.req.parseBody({ dot: true });

  return c.json(body);
});

// --- GET extended routes ---

app.get("/users/search", (c) => c.json({ users: [{ id: "1", name: "John Doe" }], total: 1 }));

app.get("/users/:userId/posts/:postId", (c) => {
  const { userId, postId } = c.req.param();

  return c.json({ id: postId, title: "My Post", userId });
});

app.get("/users/:userId/posts/:postId/comments/:commentId/replies/:replyId", (c) => {
  const { replyId, commentId } = c.req.param();

  return c.json({ id: replyId, content: "Reply content", commentId });
});

app.get("/api/text", (c) => c.text("plain text response"));

app.get("/validation", (c) => c.json({ id: "123", name: "John Doe" })); // missing 'age' field

// --- Sub-resource routes ---

app.get("/users/:id/info", (c) =>
  c.json({
    id: c.req.param("id"),

    profile: { bio: "Software engineer", location: "San Francisco" },
  }),
);

app.get("/users/:id/metrics", (c) =>
  c.json({ userId: c.req.param("id"), loginCount: 42, lastLogin: "2023-01-01T11:00:00Z" }),
);

app.get("/users/:id/settings", (c) => c.json({ userId: c.req.param("id"), theme: "dark" }));

app.get("/users/:id/profile", (c) => c.json({ userId: c.req.param("id"), bio: "Developer" }));

app.put("/users/:id/info", async (c) => {
  const { id } = c.req.param();

  return c.json({
    id,

    profile: { bio: "Updated bio", location: "Updated location" },

    updatedAt: "2023-01-01T13:00:00Z",
  });
});

// --- Root path ---

app.get("/", (c) => c.json({ message: "Welcome to the API", service: "mock-dash" }));

// --- Stream routes ---

app.get("/download/file", (c) =>
  stream(c, async (s) => {
    await s.write(new Uint8Array([1, 2, 3]));
  }),
);

app.get("/download/image", (_c) => {
  const pngBytes = new Uint8Array([137, 80, 78, 71]);

  return new Response(pngBytes, { headers: { "Content-Type": "image/png" } });
});

app.get("/stream/users", (c) =>
  stream(c, async (s) => {
    await s.writeln(JSON.stringify({ id: "1", name: "John" }));

    await s.writeln(JSON.stringify({ id: "2", name: "Jane" }));
  }),
);

app.get("/stream/numbers", (c) =>
  stream(c, async (s) => {
    await s.writeln(JSON.stringify({ value: "not-a-number" }));

    await s.writeln(JSON.stringify({ value: 42 }));
  }),
);

app.get("/stream/slow", (c) =>
  stream(c, async (s) => {
    for (let seq = 1; seq <= 10; seq++) {
      await s.writeln(JSON.stringify({ seq }));

      await new Promise((r) => setTimeout(r, 5));
    }
  }),
);

// --- SSE routes ---

app.get("/events/notifications", (c) =>
  streamSSE(c, async (s) => {
    await s.writeSSE({
      event: "notification",

      data: JSON.stringify({ id: "1", message: "Hi" }),
    });
  }),
);

app.get("/users/:userId/events", (c) =>
  streamSSE(c, async (s) => {
    await s.writeSSE({
      event: "userUpdate",

      data: JSON.stringify({ userId: "user123", field: "name", newValue: "John Smith" }),
    });

    await s.writeSSE({
      event: "userAction",

      data: JSON.stringify({
        userId: "user123",

        action: "login",

        timestamp: "2023-01-01T12:00:00Z",
      }),
    });
  }),
);

app.get("/events/errors", (c) =>
  streamSSE(c, async (s) => {
    await s.writeSSE({ data: "{ invalid json }" });

    await s.writeSSE({
      event: "validEvent",

      data: JSON.stringify({ message: "valid" }),
    });
  }),
);

app.get("/multi-events", (c) =>
  streamSSE(c, async (s) => {
    await s.writeSSE({
      event: "typeA",

      data: JSON.stringify({ type: "A", data: "string data" }),
    });

    await s.writeSSE({
      event: "typeB",

      data: JSON.stringify({ type: "B", value: 42 }),
    });

    await s.writeSSE({
      event: "typeC",

      data: JSON.stringify({ type: "C", items: ["item1", "item2"] }),
    });
  }),
);

app.get("/secure/events", (c) =>
  streamSSE(c, async (s) => {
    await s.writeSSE({
      event: "secureMessage",

      data: JSON.stringify({ encrypted: "encrypted-data" }),
    });
  }),
);

// --- Error route ---

app.get("/broken", (c) => c.text("{ invalid", { headers: { "Content-Type": "application/json" } }));

// --- Alias-specific routes ---

app.get("/api/v2/resources/:id", (c) =>
  c.json({ id: c.req.param("id"), service: "api", version: "v2" }),
);

app.post("/api/v1/users", async (c) => {
  const body = await c.req.json();

  return c.json({ id: "new-id", name: body.name, email: body.email });
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.put("/api/v1/users/:id", async (c) => {
  const body = await c.req.json();

  return c.json({ id: c.req.param("id"), name: body.name, updated: true });
});

// --- GLOBAL CLIENT SETUP ---
const clientConfig = {
  apiSchema: globalApiSchema,
  baseURL: "http://localhost",
  fetch: (...args: Parameters<typeof app.fetch>) => app.fetch(...args),
  alias: {
    api: "/api/v1",
    service: "/api",
    version: "v2",
    root: "/",
  },
};

const client = createApiClient(clientConfig);

// --- TEST SUITE ---

describe("Unified API Client Test Suite (Flat Syntax)", () => {
  // =============================================

  // STANDARD CRUD

  // =============================================

  describe("Standard CRUD", () => {
    it("should handle basic GET with params and aliases", async () => {
      const res = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(res.data?.id).toBe("123");

      expect(res.data?.name).toBe("John Doe");
    });

    it("should handle GET request without parameters", async () => {
      const res = await client.get("/users");

      expect(res.data).toHaveLength(1);

      expect(res.data?.[0].name).toBe("John");
    });

    it("should handle POST with JSON body", async () => {
      const res = await client.post("/users", {
        json: { name: "Jane", email: "jane@test.com" },
      });

      expect(res.data?.name).toBe("Jane");

      expect(res.data?.id).toBe("new");
    });

    it("should handle POST with form data", async () => {
      const res = await client.post("/users/:id/avatar", {
        param: { id: "123" },

        form: { file: "file-data", description: "User avatar" },
      });

      expect(res.data).toHaveProperty("avatarUrl");

      expect(res.data?.avatarUrl).toBeDefined();
    });

    it("should apply defaults for JSON body", async () => {
      const res = await client.post("/users/default", {
        json: { name: "Jane Doe" },
      });

      expect(res.data).toEqual({ name: "Jane Doe", role: "user" });
    });

    it("should apply defaults for form body", async () => {
      const res = await client.post("/form", {
        form: { field: "value" },
      });

      expect(res.data).toEqual({ field: "value", optionalField: "default-value" });
    });

    it("should handle POST with void response", async () => {
      const res = await client.post("/void-post", {
        json: { field: "value" },
      });

      expect(res.error).toBeUndefined();

      expect(res.data).toBeUndefined();
    });

    it("should handle PUT with params and JSON body", async () => {
      const res = await client.put("/users/:id", {
        param: { id: "456" },

        json: { name: "Jane Doe", email: "jane@example.com" },
      });

      expect(res.data?.updatedAt).toBe("2023-01-01");
    });

    it("should handle PATCH for partial updates", async () => {
      const res = await client.patch("/users/:id", {
        param: { id: "123" },

        json: { name: "Patched Name" },
      });

      expect(res.data).toHaveProperty("name");

      if (res.data) expect(res.data.name).toBe("Patched Name");
    });

    it("should handle DELETE with params (void response)", async () => {
      const res = await client.delete("/users/:id", {
        param: { id: "789" },
      });

      expect(res.error).toBeUndefined();
    });

    it("should handle DELETE with confirmation response", async () => {
      const res = await client.delete("/users/:id/confirm", {
        param: { id: "123" },
      });

      expect(res.data).toHaveProperty("deleted");

      if (res.data) {
        expect(res.data.deleted).toBe(true);

        expect(res.data.deletedAt).toBe("2023-01-01T12:00:00Z");
      }
    });
  });

  // =============================================

  // GET EXTENDED

  // =============================================

  describe("GET Extended", () => {
    it("should handle optional query parameters", async () => {
      const res = await client.get("/users/search", {
        query: { q: "john" },
      });

      expect(res.data).toHaveProperty("users");

      if (res.data) {
        expect(res.data.users).toHaveLength(1);
      }
    });

    it("should support custom headers per request", async () => {
      const fetchSpy = vi.spyOn(app, "fetch");

      await client.get("/{api}/users/:id", {
        param: { id: "123" },

        headers: { Authorization: "Bearer token123", "X-Custom": "value" },
      });

      const request = fetchSpy.mock.calls[0][0] as Request;

      expect(request.headers.get("Authorization")).toBe("Bearer token123");

      expect(request.headers.get("X-Custom")).toBe("value");

      fetchSpy.mockRestore();
    });

    it("should perform nested path parameter resolution", async () => {
      const res = await client.get("/users/:userId/posts/:postId", {
        param: { userId: "456", postId: "123" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("123");

        expect(res.data.userId).toBe("456");

        expect(res.data.title).toBe("My Post");
      }
    });

    it("should handle deep nested resources (4 path params)", async () => {
      const res = await client.get(
        "/users/:userId/posts/:postId/comments/:commentId/replies/:replyId",

        {
          param: { userId: "123", postId: "456", commentId: "789", replyId: "101" },
        },
      );

      expect(res.data).toHaveProperty("id");

      if (res.data) expect(res.data.id).toBe("101");
    });

    it("should handle API with different content types (text)", async () => {
      const res = await client.get("/api/text");

      if (res.data) expect(res.data).toBe("plain text response");
    });

    it("should handle error responses with different status codes", async () => {
      const testCases = [400, 401, 403, 500];

      for (const status of testCases) {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: `Error ${status}` }), {
            status,

            headers: { "Content-Type": "application/json" },
          }),
        );

        const localClient = createApiClient({
          ...clientConfig,

          fetch: mockFetch,
        });

        const res = await localClient.get("/users");

        expect(res).toHaveProperty("error");

        if (res.error) expect((res.error as ApiError).status).toBe(status);
      }
    });

    it("should handle 404 errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "User not found" }), {
          status: 404,

          headers: { "Content-Type": "application/json" },
        }),
      );

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      const res = await localClient.get("/{api}/users/:id", {
        param: { id: "999" },
      });

      expect(res).toHaveProperty("error");

      if (res.error) expect((res.error as ApiError).status).toBe(404);
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      const res = await localClient.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(res).toHaveProperty("error");

      if (res.error) expect(res.error).toBeInstanceOf(NetworkError);
    });

    it("should support AbortSignal for request cancellation", async () => {
      const mockFetch = vi.fn().mockImplementation((input: Request) => {
        if (input.signal?.aborted) {
          return Promise.reject(new DOMException("Request aborted", "AbortError"));
        }

        return new Promise((resolve) => setTimeout(resolve, 1000));
      });

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      const controller = new AbortController();

      controller.abort();

      const res = await localClient.get("/{api}/users/:id", {
        param: { id: "123" },

        signal: controller.signal,
      });

      expect(res).toHaveProperty("error");

      if (res.error) expect(res.error).toBeInstanceOf(NetworkError);
    });

    it("should handle malformed JSON responses gracefully", async () => {
      const res = await client.get("/broken");

      expect(res).toHaveProperty("error");

      if (res.error) expect(res.error).toBeInstanceOf(ApiError);
    });
  });

  // =============================================

  // STREAMING & REAL-TIME

  // =============================================

  describe("Streaming & Real-time", () => {
    describe("Binary Stream", () => {
      it("should handle binary streams", async () => {
        const result = await client.get("/download/file");

        const collected: number[] = [];

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "binary") collected.push(...Array.from(chunk.data));
          }
        }

        expect(collected).toEqual([1, 2, 3]);
      });

      it("should respect specified content type (image/png)", async () => {
        const result = await client.get("/download/image");

        const collected: number[] = [];

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "binary") collected.push(...Array.from(chunk.data as Uint8Array));
          }
        }

        expect(collected.slice(0, 4)).toEqual([137, 80, 78, 71]);
      });
    });

    describe("JSON Stream (NDJSON)", () => {
      it("should stream multiple JSON items and validate each", async () => {
        const result = await client.get("/stream/users");

        const items: { id: string; name: string }[] = [];

        const errors: Error[] = [];

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "json") items.push(chunk.data);

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(items).toHaveLength(2);

        expect(items[0].name).toBe("John");

        expect(items[1].name).toBe("Jane");

        expect(errors).toHaveLength(0);
      });

      it("should surface validation errors for malformed items and continue", async () => {
        const result = await client.get("/stream/numbers");

        const received: { value: number }[] = [];

        const errors: Error[] = [];

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "json") received.push(chunk.data);

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(received).toEqual([{ value: 42 }]);

        expect(errors).toHaveLength(1);
      });

      it("should support aborting JSON stream early", async () => {
        const controller = new AbortController();

        const received: { seq: number }[] = [];

        const result = await client.get("/stream/slow", {
          signal: controller.signal,
        });

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "json") {
              received.push(chunk.data);

              if (received.length === 3) {
                controller.abort();

                break;
              }
            }
          }
        }

        expect(received.length).toBe(3);
      });
    });

    describe("Server-Sent Events (SSE)", () => {
      it("should handle basic SSE endpoint", async () => {
        const result = await client.get("/events/notifications", {
          query: { userId: "123" },
        });

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "event" && chunk.name === "notification") {
              expect(chunk.data.message).toBe("Hi");

              break;
            }
          }
        }
      });

      it("should handle SSE with path parameters", async () => {
        const receivedUpdates: any[] = [];

        const receivedActions: any[] = [];

        const errors: Error[] = [];

        const result = await client.get("/users/:userId/events", {
          param: { userId: "user123" },

          query: { since: "2023-01-01" },
        });

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "event") {
              if (chunk.name === "userUpdate") receivedUpdates.push(chunk.data);

              if (chunk.name === "userAction") receivedActions.push(chunk.data);
            }

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(receivedUpdates).toHaveLength(1);

        expect(receivedActions).toHaveLength(1);

        expect(errors).toHaveLength(0);
      });

      it("should handle SSE connection errors (500 status)", async () => {
        const mockFetch = vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 }));

        const localClient = createApiClient({
          ...clientConfig,

          fetch: mockFetch,
        });

        const result = await localClient.get("/events/notifications", {
          query: { userId: "123" },
        });

        expect(result).toHaveProperty("error");

        if (result.error) {
          expect(result.error).toBeInstanceOf(ApiError);

          expect((result.error as ApiError).status).toBe(500);
        }
      });

      it("should handle SSE network errors", async () => {
        const mockFetch = vi.fn().mockRejectedValue(new TypeError("Network error"));

        const localClient = createApiClient({
          ...clientConfig,

          fetch: mockFetch,
        });

        const res = await localClient.get("/events/notifications", {
          query: { userId: "123" },
        });

        expect(res).toHaveProperty("error");

        if (res.error) expect(res.error).toBeInstanceOf(NetworkError);
      });

      it("should handle malformed SSE data", async () => {
        const received: any[] = [];

        const errors: Error[] = [];

        const result = await client.get("/events/errors");

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "event") received.push(chunk.data);

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(received).toHaveLength(1);

        expect(errors).toHaveLength(1);
      });

      it("should handle SSE with custom headers and interceptors", async () => {
        const localClient = createApiClient(clientConfig);

        const requestInterceptor = vi.fn((_ctx: any, options: any) => ({
          ...options,

          headers: { ...options.headers, Authorization: "Bearer token123" },
        }));

        localClient.interceptors.request.use(requestInterceptor);

        const received: any[] = [];

        const errors: Error[] = [];

        const result = await localClient.get("/secure/events", {
          query: { token: "abc123" },

          headers: { "X-Custom-Header": "custom-value" },
        });

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "event") received.push(chunk.data);

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(requestInterceptor).toHaveBeenCalled();

        expect(received).toHaveLength(1);

        expect(errors).toHaveLength(0);
      });

      it("should support AbortSignal for SSE connections", async () => {
        const mockFetch = vi.fn().mockImplementation((request: Request) => {
          if (request.signal?.aborted)
            return Promise.reject(new DOMException("Request aborted", "AbortError"));

          const s = new ReadableStream({ start() {} });

          return Promise.resolve(
            new Response(s, {
              status: 200,

              headers: { "Content-Type": "text/event-stream" },
            }),
          );
        });

        const localClient = createApiClient({
          ...clientConfig,

          fetch: mockFetch,
        });

        const controller = new AbortController();

        controller.abort();

        const res = await localClient.get("/events/notifications", {
          query: { userId: "123" },

          signal: controller.signal,
        });

        expect(res).toHaveProperty("error");

        if (res.error) expect(res.error).toBeInstanceOf(NetworkError);
      });

      it("should handle multiple event types correctly", async () => {
        const receivedA: any[] = [];

        const receivedB: any[] = [];

        const receivedC: any[] = [];

        const errors: Error[] = [];

        const result = await client.get("/multi-events");

        if (result.data) {
          for await (const chunk of result.data) {
            if (chunk.type === "event") {
              if (chunk.name === "typeA") receivedA.push(chunk.data);

              if (chunk.name === "typeB") receivedB.push(chunk.data);

              if (chunk.name === "typeC") receivedC.push(chunk.data);
            }

            if (chunk.type === "error") errors.push(chunk.error);
          }
        }

        expect(receivedA).toHaveLength(1);

        expect(receivedB).toHaveLength(1);

        expect(receivedC).toHaveLength(1);

        expect(errors).toHaveLength(0);
      });
    });
  });

  // =============================================

  // WEBSOCKET FUNCTIONALITY

  // =============================================

  describe("WebSocket Functionality", () => {
    let originalWebSocket: typeof WebSocket;

    beforeEach(() => {
      originalWebSocket = global.WebSocket;

      global.WebSocket = MockWebSocket as any;

      MockWebSocket.lastInstance = null;
    });

    afterEach(() => {
      global.WebSocket = originalWebSocket;
    });

    it("should handle basic WebSocket endpoint with status events", async () => {
      const result = await client.get("/chat");

      if (result.data) {
        const statusUpdates: string[] = [];

        const messages: any[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            ws.simulateMessage(JSON.stringify({ id: "1", text: "Hello" }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "status") statusUpdates.push(chunk.status);

          if (chunk.type === "message") messages.push(chunk.data);
        }

        expect(statusUpdates).toContain("connecting");

        expect(statusUpdates).toContain("open");

        expect(statusUpdates).toContain("closed");

        expect(messages).toHaveLength(1);
      }
    }, 10000);

    it("should connect and receive messages", async () => {
      const result = await client.get("/chat");

      if (result.data) {
        setTimeout(() => {
          MockWebSocket.lastInstance?.simulateMessage(
            JSON.stringify({ id: "ws1", text: "Socket Message" }),
          );

          MockWebSocket.lastInstance?.close();
        }, 10);

        for await (const chunk of result.data) {
          if (chunk.type === "message") {
            expect(chunk.data.text).toBe("Socket Message");

            break;
          }
        }
      }
    });

    it("should handle WebSocket with path parameters", async () => {
      const result = await client.get("/users/:userId/updates", {
        param: { userId: "user123" },
      });

      expect(result).toHaveProperty("data");

      expect(result).toHaveProperty("controller");

      if (result.controller) {
        const ws = MockWebSocket.lastInstance;

        expect(ws?.url).toContain("user123");
      }
    });

    it("should send messages through controller", async () => {
      const result = await client.get("/chat");

      if (result.controller) {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const ws = MockWebSocket.lastInstance;

        const sendSpy = vi.spyOn(ws!, "send");

        result.controller.send({ text: "Hello World" });

        expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ text: "Hello World" }));
      }
    });

    it("should handle malformed WebSocket messages", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const received: any[] = [];

        const errors: Error[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            ws.simulateMessage("{ invalid json }");

            ws.simulateMessage(JSON.stringify({ value: "ok" }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "message") received.push(chunk.data);

          if (chunk.type === "error") errors.push(chunk.error);
        }

        expect(received).toHaveLength(1);

        expect(errors.length).toBeGreaterThan(0);
      }
    }, 10000);

    it("should handle validation errors for invalid message data", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const errors: Error[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            ws.simulateMessage(JSON.stringify({ invalid: "data" }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "error") errors.push(chunk.error);
        }

        expect(errors.length).toBeGreaterThan(0);
      }
    }, 10000);

    it("should handle WebSocket connection errors", async () => {
      global.WebSocket = class {
        constructor() {
          throw new Error("Connection failed");
        }
      } as any;

      const result = await client.get("/chat");

      expect(result).toHaveProperty("error");

      if (result.error) {
        expect(result.error).toBeInstanceOf(NetworkError);
      }
    });

    it("should close WebSocket connection via controller", async () => {
      const result = await client.get("/chat");

      if (result.controller && result.data) {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const ws = MockWebSocket.lastInstance;

        const closeSpy = vi.spyOn(ws as any, "close");

        result.controller.close(1000, "Normal closure");

        expect(closeSpy).toHaveBeenCalledWith(1000, "Normal closure");
      }
    });

    it("should handle query parameters in WebSocket URL", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc123", room: "general" },
      });

      if (result.controller) {
        const ws = MockWebSocket.lastInstance;

        expect(ws?.url).toContain("token=abc123");

        expect(ws?.url).toContain("room=general");
      }
    });

    it("should convert http to ws protocol", async () => {
      const localClient = createApiClient({
        ...clientConfig,

        baseURL: "http://localhost:3000",
      });

      const result = await localClient.get("/chat");

      if (result.controller) {
        const ws = MockWebSocket.lastInstance;

        expect(ws?.url).toMatch(/^ws:\/\//);
      }
    });

    it("should convert https to wss protocol", async () => {
      const localClient = createApiClient({
        ...clientConfig,

        baseURL: "https://example.com",
      });

      const result = await localClient.get("/chat");

      if (result.controller) {
        const ws = MockWebSocket.lastInstance;

        expect(ws?.url).toMatch(/^wss:\/\//);
      }
    });

    it("should expose WebSocket readyState", async () => {
      const result = await client.get("/chat");

      if (result.controller) {
        expect(result.controller.readyState).toBeDefined();

        expect(typeof result.controller.readyState).toBe("number");
      }
    });

    it("should handle sendRaw for non-JSON messages", async () => {
      const result = await client.get("/chat");

      if (result.controller) {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const ws = MockWebSocket.lastInstance;

        const sendSpy = vi.spyOn(ws as any, "send");

        result.controller.sendRaw("raw message");

        expect(sendSpy).toHaveBeenCalledWith("raw message");
      }
    });

    it("should handle binary ArrayBuffer messages", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const binaryMessages: (ArrayBuffer | Blob | SharedArrayBuffer)[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            const buffer = new ArrayBuffer(8);

            const view = new Uint8Array(buffer);

            view.set([1, 2, 3, 4, 5, 6, 7, 8]);

            ws.dispatchEvent(new MockMessageEvent("message", { data: buffer }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "binary") binaryMessages.push(chunk.data);
        }

        expect(binaryMessages).toHaveLength(1);

        expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer);

        if (binaryMessages[0] instanceof ArrayBuffer) {
          expect(binaryMessages[0].byteLength).toBe(8);
        }
      }
    }, 10000);

    it("should handle binary Blob messages", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const binaryMessages: (ArrayBuffer | Blob | SharedArrayBuffer)[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            const blob = new Blob(["test data"], { type: "application/octet-stream" });

            ws.dispatchEvent(new MockMessageEvent("message", { data: blob }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "binary") binaryMessages.push(chunk.data);
        }

        expect(binaryMessages).toHaveLength(1);

        expect(binaryMessages[0]).toBeInstanceOf(Blob);
      }
    }, 10000);

    it("should handle TypedArray messages (Uint8Array)", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const binaryMessages: (ArrayBuffer | Blob | SharedArrayBuffer)[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            const typedArray = new Uint8Array([10, 20, 30, 40, 50]);

            ws.dispatchEvent(new MockMessageEvent("message", { data: typedArray }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "binary") binaryMessages.push(chunk.data);
        }

        expect(binaryMessages).toHaveLength(1);

        expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer);

        if (binaryMessages[0] instanceof ArrayBuffer) {
          expect(binaryMessages[0].byteLength).toBe(5);

          const view = new Uint8Array(binaryMessages[0]);

          expect(Array.from(view)).toEqual([10, 20, 30, 40, 50]);
        }
      }
    }, 10000);

    it("should handle DataView messages", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const binaryMessages: (ArrayBuffer | Blob | SharedArrayBuffer)[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            const buffer = new ArrayBuffer(16);

            const dataView = new DataView(buffer);

            dataView.setInt32(0, 42);

            dataView.setFloat32(4, 3.14);

            ws.dispatchEvent(new MockMessageEvent("message", { data: dataView }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "binary") binaryMessages.push(chunk.data);
        }

        expect(binaryMessages).toHaveLength(1);

        expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer);

        if (binaryMessages[0] instanceof ArrayBuffer) {
          expect(binaryMessages[0].byteLength).toBe(16);

          const view = new DataView(binaryMessages[0]);

          expect(view.getInt32(0)).toBe(42);

          expect(view.getFloat32(4)).toBeCloseTo(3.14, 2);
        }
      }
    }, 10000);

    it("should handle mixed JSON and binary messages", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const jsonMessages: any[] = [];

        const binaryMessages: (ArrayBuffer | Blob | SharedArrayBuffer)[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            ws.simulateMessage(JSON.stringify({ value: "hello" }));

            const buffer = new ArrayBuffer(4);

            ws.dispatchEvent(new MockMessageEvent("message", { data: buffer }));

            ws.simulateMessage(JSON.stringify({ value: "world" }));

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "message") jsonMessages.push(chunk.data);

          if (chunk.type === "binary") binaryMessages.push(chunk.data);
        }

        expect(jsonMessages).toHaveLength(2);

        expect(jsonMessages[0]).toEqual({ value: "hello" });

        expect(jsonMessages[1]).toEqual({ value: "world" });

        expect(binaryMessages).toHaveLength(1);

        expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer);
      }
    }, 10000);

    it("should handle sending message when WebSocket is closed", async () => {
      const result = await client.get("/chat");

      if (result.controller) {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const ws = MockWebSocket.lastInstance;

        ws?.close();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(() => {
          result.controller.send({ text: "test" });
        }).toThrow("WebSocket is not open");
      }
    });

    it("should handle sendRaw when WebSocket is closed", async () => {
      const result = await client.get("/chat");

      if (result.controller) {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const ws = MockWebSocket.lastInstance;

        ws?.close();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(() => {
          result.controller.sendRaw("test message");
        }).toThrow("WebSocket is not open");
      }
    });

    it("should handle WebSocket error events", async () => {
      const result = await client.get("/updates", {
        query: { token: "abc" },
      });

      if (result.data) {
        const errors: Error[] = [];

        setTimeout(() => {
          const ws = MockWebSocket.lastInstance;

          if (ws) {
            ws.simulateError();

            ws.close();
          }
        }, 50);

        for await (const chunk of result.data) {
          if (chunk.type === "error") errors.push(chunk.error);
        }

        expect(errors.length).toBeGreaterThan(0);

        expect(errors[0].message).toBe("WebSocket error occurred");
      }
    }, 10000);

    it("should handle non-Error instances in WebSocket constructor", async () => {
      global.WebSocket = class {
        constructor() {
          throw "Connection failed - not an error instance";
        }
      } as any;

      const result = await client.get("/chat");

      expect(result).toHaveProperty("error");

      if (result.error) {
        expect(result.error).toBeInstanceOf(NetworkError);

        expect(result.error.message).toBe("WebSocket connection failed");
      }
    });
  });

  // =============================================

  // ERROR HANDLING & THROW ON ERROR

  // =============================================

  describe("Error Handling & throwOnError", () => {
    it("should handle malformed JSON", async () => {
      const res = await client.get("/broken");

      expect(res.error).toBeInstanceOf(ApiError);
    });

    it("should throw via throwOnError option (GET success)", async () => {
      const data = await client.get("/{api}/users/:id", {
        param: { id: "123" },

        throwOnError: true,
      });

      expect(data.name).toBe("John Doe");
    });

    it("should throw ApiError on HTTP error status via throwOnError", async () => {
      await expect(client.get("/broken", { throwOnError: true })).rejects.toThrow(ApiError);
    });

    it("should throw ValidationError on response validation failure", async () => {
      // /validation returns { id, name } but schema expects { id, age } — will fail validation

      await expect(client.get("/validation", { throwOnError: true })).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw NetworkError on network failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      await expect(
        localClient.get("/{api}/users/:id", {
          param: { id: "123" },

          throwOnError: true,
        }),
      ).rejects.toThrow(NetworkError);
    });

    it("should return data directly on successful POST with throwOnError", async () => {
      const data = await client.post("/users", {
        json: { name: "Jane Doe", email: "jane@example.com" },

        throwOnError: true,
      });

      expect(data.name).toBe("Jane Doe");

      expect(data.id).toBe("new");
    });

    it("should throw error on POST failure with throwOnError", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid" }), {
          status: 400,

          headers: { "Content-Type": "application/json" },
        }),
      );

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      await expect(
        localClient.post("/users", {
          json: { name: "John", email: "john@example.com" },

          throwOnError: true,
        }),
      ).rejects.toThrow(ApiError);
    });

    it("should return data directly on successful PUT with throwOnError", async () => {
      const data = await client.put("/users/:id", {
        param: { id: "123" },

        json: { name: "Updated Jane", email: "updated.jane@example.com" },

        throwOnError: true,
      });

      expect(data.name).toBe("Updated");

      expect(data.updatedAt).toContain("2023-01-01");
    });

    it("should return data directly on successful PATCH with throwOnError", async () => {
      const data = await client.patch("/users/:id", {
        param: { id: "123" },

        json: { name: "Patched Name" },

        throwOnError: true,
      });

      expect(data.name).toBe("Patched Name");

      expect(data.id).toBe("123");
    });

    it("should return data directly on DELETE with JSON response via throwOnError", async () => {
      const data = await client.delete("/users/:id/confirm", {
        param: { id: "123" },

        throwOnError: true,
      });

      expect(data.deleted).toBe(true);

      expect(data.deletedAt).toBe("2023-01-01T12:00:00Z");
    });

    it("should handle DELETE with void response via throwOnError", async () => {
      const result = await client.delete("/users/:id", {
        param: { id: "123" },

        throwOnError: true,
      });

      expect(result).toBeUndefined();
    });

    it("should work with throwOnError and query parameters", async () => {
      const data = await client.get("/users/search", {
        query: { q: "john", page: "1", limit: "10" },

        throwOnError: true,
      });

      expect(data.users).toHaveLength(1);

      expect(data.total).toBe(1);
    });

    it("should work with throwOnError and nested path parameters", async () => {
      const data = await client.get("/users/:userId/posts/:postId", {
        param: { userId: "456", postId: "123" },

        throwOnError: true,
      });

      expect(data.id).toBe("123");

      expect(data.userId).toBe("456");

      expect(data.title).toBe("My Post");
    });

    it("should work with throwOnError and interceptors", async () => {
      const localClient = createApiClient(clientConfig);

      localClient.interceptors.request.use((_context: any, options: any) => ({
        ...options,

        headers: { ...options.headers, "X-Custom-Header": "test-value" },
      }));

      const data = await localClient.get("/{api}/users/:id", {
        param: { id: "123" },

        throwOnError: true,
      });

      expect(data.id).toBe("123");

      expect(data.name).toBe("John Doe");
    });

    it("should demonstrate difference between safe and unsafe calls", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,

          headers: { "Content-Type": "application/json" },
        }),
      );

      const localClient = createApiClient({
        ...clientConfig,

        fetch: mockFetch,
      });

      // Safe call returns error in result object

      const safeResult = await localClient.get("/{api}/users/:id", {
        param: { id: "999" },
      });

      expect(safeResult).toHaveProperty("error");

      expect(safeResult.error).toBeInstanceOf(ApiError);

      // Unsafe call throws the error

      await expect(
        localClient.get("/{api}/users/:id", {
          param: { id: "999" },

          throwOnError: true,
        }),
      ).rejects.toThrow(ApiError);
    });
  });

  // =============================================

  // INTERCEPTORS

  // =============================================

  describe("Interceptors", () => {
    it("should execute request and response interceptors", async () => {
      const order: string[] = [];

      const localClient = createApiClient(clientConfig);

      localClient.interceptors.request.use((_: any, o: any) => {
        order.push("req");

        return o;
      });

      localClient.interceptors.response.use((_: any, r: any) => {
        order.push("res");

        return r;
      });

      await localClient.get("/users");

      expect(order).toEqual(["req", "res"]);
    });

    it("should support request interceptors with header verification", async () => {
      const fetchSpy = vi.spyOn(app, "fetch");

      const localClient = createApiClient(clientConfig);

      const requestInterceptor = vi.fn((_context: any, options: any) => ({
        ...options,

        headers: { ...options.headers, "X-Custom-Header": "test-value" },
      }));

      localClient.interceptors.request.use(requestInterceptor);

      await localClient.get("/{api}/users/:id", { param: { id: "123" } });

      const request = fetchSpy.mock.calls[0][0] as Request;

      expect(requestInterceptor).toHaveBeenCalled();

      expect(request.headers.get("X-Custom-Header")).toBe("test-value");

      fetchSpy.mockRestore();
    });

    it("should support response interceptors", async () => {
      const localClient = createApiClient(clientConfig);

      const responseInterceptor = vi.fn((_context: any, response: any) => response);

      localClient.interceptors.response.use(responseInterceptor);

      await localClient.get("/{api}/users/:id", { param: { id: "123" } });

      expect(responseInterceptor).toHaveBeenCalled();
    });

    it("should support local request/response transformers", async () => {
      const localClient = createApiClient(clientConfig);

      const localRequestTransformer = vi.fn((_context: any, options: any) => ({
        ...options,

        headers: { ...options.headers, "X-Local-Header": "local-value" },
      }));

      const localResponseTransformer = vi.fn((_context: any, response: any) => response);

      await localClient.get("/{api}/users/:id", {
        param: { id: "123" },

        transformRequest: localRequestTransformer,

        transformResponse: localResponseTransformer,
      });

      expect(localRequestTransformer).toHaveBeenCalled();

      expect(localResponseTransformer).toHaveBeenCalled();
    });

    it("should handle interceptor chaining correctly", async () => {
      const localClient = createApiClient(clientConfig);

      const order: string[] = [];

      localClient.interceptors.request.use((_c: any, o: any) => {
        order.push("request-1");

        return { ...o, headers: { ...o.headers, "X-First": "first" } };
      });

      localClient.interceptors.request.use((_c: any, o: any) => {
        order.push("request-2");

        return { ...o, headers: { ...o.headers, "X-Second": "second" } };
      });

      localClient.interceptors.response.use((_c: any, r: any) => {
        order.push("response-1");

        return r;
      });

      localClient.interceptors.response.use((_c: any, r: any) => {
        order.push("response-2");

        return r;
      });

      await localClient.get("/{api}/users/:id", { param: { id: "123" } });

      expect(order).toEqual(["request-1", "request-2", "response-1", "response-2"]);
    });
  });

  // =============================================

  // ALIAS FUNCTIONALITY

  // =============================================

  describe("Alias Functionality", () => {
    it("should support basic path alias replacement", async () => {
      const res = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("123");

        expect(res.data.name).toBe("John Doe");
      }
    });

    it("should support multiple path aliases in the same endpoint", async () => {
      const res = await client.get("/{service}/{version}/resources/:id", {
        param: { id: "456" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("456");

        expect(res.data.service).toBe("api");

        expect(res.data.version).toBe("v2");
      }
    });

    it("should support empty aliases", async () => {
      // With empty aliases, "/{service}/{version}/resources/:id" → "/resources/:id"

      const localApp = new Hono();

      localApp.get("/resources/:id", (c) =>
        c.json({ id: c.req.param("id"), service: "api", version: "v2" }),
      );

      const emptyAliasClient = createApiClient({
        apiSchema: globalApiSchema,

        baseURL: "http://localhost",

        fetch: localApp.fetch,

        alias: { api: "/api/v1", service: "", version: "", root: "/" },
      });

      const res = await emptyAliasClient.get("/{service}/{version}/resources/:id", {
        param: { id: "456" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("456");
      }
    });

    it("should support path aliases with query parameters", async () => {
      const res = await client.get("/{api}/users/search", {
        query: { q: "john", limit: "10" },
      });

      expect(res.data).toHaveLength(1);

      if (res.data) {
        expect(res.data[0].name).toBe("John Doe");
      }
    });

    it("should support path aliases with POST requests and JSON body", async () => {
      const res = await client.post("/{api}/users", {
        json: { name: "Jane Doe", email: "jane@example.com" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("new-id");

        expect(res.data.name).toBe("Jane Doe");

        expect(res.data.email).toBe("jane@example.com");
      }
    });

    it("should handle root path aliases correctly", async () => {
      const res = await client.get("/{root}/health");

      expect(res.data).toHaveProperty("status");

      if (res.data) {
        expect(res.data.status).toBe("ok");
      }
    });

    it("should normalize duplicate slashes in alias values", async () => {
      const localClient = createApiClient({
        ...clientConfig,

        alias: {
          ...clientConfig.alias,

          api: "///api///v1//",
        },
      });

      const res = await localClient.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(res.data).toHaveProperty("id");

      if (res.data) {
        expect(res.data.id).toBe("123");

        expect(res.data.name).toBe("John Doe");
      }
    });

    it("should work with different HTTP methods and path aliases", async () => {
      // Test GET with alias

      const getRes = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(getRes.data).toHaveProperty("name");

      if (getRes.data) expect(getRes.data.name).toBe("John Doe");

      // Test PUT with alias

      const putRes = await client.put("/{api}/users/:id", {
        param: { id: "123" },

        json: { name: "Updated Name" },
      });

      expect(putRes.data).toHaveProperty("updated");

      if (putRes.data) {
        expect(putRes.data.name).toBe("Updated Name");

        expect(putRes.data.updated).toBe(true);
      }
    });

    it("should handle endpoints without aliases alongside aliased ones", async () => {
      // Without alias

      const res1 = await client.get("/users");

      expect(res1.data).toHaveLength(1);

      if (res1.data) expect(res1.data[0].name).toBe("John");

      // With alias

      const res2 = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(res2.data).toHaveProperty("name");

      if (res2.data) expect(res2.data.name).toBe("John Doe");
    });
  });

  // =============================================

  // MULTIPLE ENDPOINTS SAME PATH

  // =============================================

  describe("Multiple Endpoints Same Path", () => {
    it("should handle multiple HTTP methods on same path parameter", async () => {
      const getUserRes = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(getUserRes.data?.id).toBe("123");

      expect(getUserRes.data?.name).toBe("John Doe");

      const updateUserRes = await client.put("/users/:id", {
        param: { id: "123" },

        json: { name: "Updated John", email: "john.updated@example.com" },
      });

      expect(updateUserRes.data?.name).toBe("Updated");

      expect(updateUserRes.data?.updatedAt).toBe("2023-01-01");

      const deleteUserRes = await client.delete("/users/:id", {
        param: { id: "123" },
      });

      expect(deleteUserRes).toHaveProperty("data");
    });

    it("should handle multiple sub-resources under same parameter", async () => {
      const getUserInfoRes = await client.get("/users/:id/info", {
        param: { id: "456" },
      });

      expect(getUserInfoRes.data?.id).toBe("456");

      expect(getUserInfoRes.data?.profile.bio).toBe("Software engineer");

      const updateUserInfoRes = await client.put("/users/:id/info", {
        param: { id: "456" },

        json: { bio: "Updated bio", location: "Updated location" },
      });

      expect(updateUserInfoRes.data?.profile.bio).toBe("Updated bio");

      expect(updateUserInfoRes.data?.updatedAt).toBe("2023-01-01T13:00:00Z");

      const getUserMetricsRes = await client.get("/users/:id/metrics", {
        param: { id: "789" },
      });

      expect(getUserMetricsRes.data?.userId).toBe("789");

      expect(getUserMetricsRes.data?.loginCount).toBe(42);
    });

    it("should handle mixed static resources and parameters correctly", async () => {
      // Static list endpoint

      const getUsersListRes = await client.get("/users");

      expect(getUsersListRes.data).toEqual([{ id: "1", name: "John" }]);

      // POST to same base path

      const createUserRes = await client.post("/users", {
        json: { name: "New User", email: "new@example.com" },
      });

      expect(createUserRes.data?.name).toBe("New User");

      // Parameter-based endpoint

      const getUserRes = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(getUserRes.data?.id).toBe("123");

      // Nested resources under parameters

      const getUserSettingsRes = await client.get("/users/:id/settings", {
        param: { id: "123" },
      });

      expect(getUserSettingsRes.data?.userId).toBe("123");

      expect(getUserSettingsRes.data?.theme).toBe("dark");

      const getUserProfileRes = await client.get("/users/:id/profile", {
        param: { id: "123" },
      });

      expect(getUserProfileRes.data?.userId).toBe("123");

      expect(getUserProfileRes.data?.bio).toBe("Developer");
    });

    it("should handle root path endpoint alongside other endpoints", async () => {
      // Root endpoint "/"

      const rootRes = await client.get("/");

      expect(rootRes.data?.message).toBe("Welcome to the API");

      expect(rootRes.data?.service).toBe("mock-dash");

      // Other root-level endpoints work alongside

      const usersRes = await client.get("/users");

      expect(usersRes.data).toHaveLength(1);

      // Parameter endpoints work alongside root

      const userRes = await client.get("/{api}/users/:id", {
        param: { id: "123" },
      });

      expect(userRes.data?.id).toBe("123");

      expect(userRes.data?.name).toBe("John Doe");
    });
  });

  // =============================================

  // FORMDATA SUPPORT

  // =============================================

  describe("FormData Support", () => {
    it("should accept a FormData instance in the form property (flat keys)", async () => {
      const formData = new FormData();
      formData.append("field", "hello");

      const res = await client.post("/form", {
        form: formData,
      });

      expect(res.data).toEqual({ field: "hello", optionalField: "default-value" });
    });

    it("should apply schema defaults when FormData omits optional fields", async () => {
      const formData = new FormData();
      formData.append("field", "only-required");

      const res = await client.post("/form", {
        form: formData,
      });

      expect(res.data).toEqual({ field: "only-required", optionalField: "default-value" });
    });

    it("should parse dot-notation keys into nested objects", async () => {
      const formData = new FormData();
      formData.append("name", "Jane");
      formData.append("address.street", "123 Main St");
      formData.append("address.city", "Springfield");

      const res = await client.post("/form/nested", {
        form: formData,
      });

      expect(res.data).toEqual({
        name: "Jane",
        address: { street: "123 Main St", city: "Springfield" },
      });
    });

    it("should parse bracket-indexed keys into arrays of objects", async () => {
      const formData = new FormData();
      formData.append("title", "Order");
      formData.append("items[0].name", "Widget");
      formData.append("items[0].qty", "3");
      formData.append("items[1].name", "Gadget");
      formData.append("items[1].qty", "7");

      const res = await client.post("/form/array", {
        form: formData,
      });

      expect(res.data).toEqual({
        title: "Order",
        items: [
          { name: "Widget", qty: "3" },
          { name: "Gadget", qty: "7" },
        ],
      });
    });

    it("should parse deeply nested dot-notation keys", async () => {
      const formData = new FormData();
      formData.append("user.name", "Alice");
      formData.append("user.address.street", "456 Oak Ave");
      formData.append("user.address.city", "Portland");

      const res = await client.post("/form/deep", {
        form: formData,
      });

      expect(res.data).toEqual({
        user: {
          name: "Alice",
          address: { street: "456 Oak Ave", city: "Portland" },
        },
      });
    });

    it("should still accept plain JS objects in the form property", async () => {
      const res = await client.post("/form", {
        form: { field: "plain-object" },
      });

      expect(res.data).toEqual({ field: "plain-object", optionalField: "default-value" });
    });

    it("should return validation error for FormData missing required fields", async () => {
      const formData = new FormData();
      // Missing required 'name' field
      formData.append("address.street", "123 Main St");
      formData.append("address.city", "Springfield");

      const res = await client.post("/form/nested", {
        form: formData,
      });

      expect(res.error).toBeDefined();
    });

    it("should throw ValidationError for invalid FormData with throwOnError", async () => {
      const formData = new FormData();
      // Missing required 'field'

      await expect(
        client.post("/form", {
          form: formData,
          throwOnError: true,
        }),
      ).rejects.toThrow();
    });

    it("should handle FormData with both flat and nested keys", async () => {
      const formData = new FormData();
      formData.append("name", "Bob");
      formData.append("address.street", "789 Pine Rd");
      formData.append("address.city", "Seattle");

      const res = await client.post("/form/nested", {
        form: formData,
      });

      expect(res.data?.name).toBe("Bob");
      expect(res.data?.address).toEqual({ street: "789 Pine Rd", city: "Seattle" });
    });

    it("should handle FormData with empty string values", async () => {
      const formData = new FormData();
      formData.append("field", "");
      formData.append("optionalField", "present");

      const res = await client.post("/form", {
        form: formData,
      });

      // Empty string is still a valid string value
      expect(res.error).toBeUndefined();
    });
  });

  // =============================================

  // UTILITIES

  // =============================================

  describe("Utilities", () => {
    it("should correctly build URI strings", () => {
      const uri = client.createEndpointUri("/{api}/users/:id", { id: "999" });

      expect(uri).toBe("http://localhost/api/v1/users/999");
    });
  });
});
