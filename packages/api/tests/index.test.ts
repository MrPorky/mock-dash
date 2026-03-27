// import { Hono } from "hono";
// import { stream, streamSSE } from "hono/streaming";
// import { beforeEach, describe, expect, it } from "vite-plus/test";
// import z from "zod";
// import {
//   defineDelete,
//   defineGet,
//   definePatch,
//   definePost,
//   definePut,
//   defineBinaryStream,
//   defineJSONStream,
//   defineSSE,
//   defineWebSocket,
//   ApiError,
//   createApiClient,
// } from "../src/index.ts";

// // --- WEB SOCKET MOCKS ---
// class MockEvent {
//   constructor(public type: string) {}
// }
// class MockMessageEvent extends MockEvent {
//   public data: any;
//   constructor(type: string, options: { data?: any } = {}) {
//     super(type);
//     this.data = options.data ?? "";
//   }
// }
// class MockCloseEvent extends MockEvent {
//   public code: number;
//   public reason: string;
//   constructor(type: string, options: { code?: number; reason?: string } = {}) {
//     super(type);
//     this.code = options.code ?? 1000;
//     this.reason = options.reason ?? "";
//   }
// }
// class MockWebSocket {
//   static lastInstance: MockWebSocket | null = null;
//   readyState = 0;
//   private listeners: Map<string, Array<(e: any) => void>> = new Map();
//   constructor(public url: string) {
//     MockWebSocket.lastInstance = this;
//     setTimeout(() => {
//       this.readyState = 1;
//       this.dispatchEvent(new MockEvent("open"));
//     }, 0);
//   }
//   send(data: string) {
//     if (this.readyState !== 1) throw new Error("WebSocket is not open");
//   }
//   close(code?: number, reason?: string) {
//     this.readyState = 2;
//     setTimeout(() => {
//       this.readyState = 3;
//       this.dispatchEvent(new MockCloseEvent("close", { code, reason }));
//     }, 0);
//   }
//   addEventListener(type: string, listener: any) {
//     if (!this.listeners.has(type)) this.listeners.set(type, []);
//     this.listeners.get(type)?.push(listener);
//   }
//   dispatchEvent(event: any) {
//     this.listeners.get(event.type)?.forEach((l) => l(event));
//     return true;
//   }
//   simulateMessage(data: string) {
//     this.dispatchEvent(new MockMessageEvent("message", { data }));
//   }
//   simulateError() {
//     this.dispatchEvent(new MockEvent("error"));
//   }
// }

// // --- GLOBAL API SCHEMA ---
// const globalApiSchema = {
//   getUser: defineGet("/{api}/users/:id", {
//     response: z.object({ id: z.string(), name: z.string() }),
//   }),
//   listUsers: defineGet("/users", {
//     response: z.array(z.object({ id: z.string(), name: z.string() })),
//   }),
//   createUser: definePost("/users", {
//     input: { json: z.object({ name: z.string(), email: z.string() }) },
//     response: z.object({ id: z.string(), name: z.string(), email: z.string() }),
//   }),
//   updateUser: definePut("/users/:id", {
//     input: { json: z.object({ name: z.string(), email: z.string().email() }) },
//     response: z.object({ id: z.string(), name: z.string(), updatedAt: z.string() }),
//   }),
//   patchUser: definePatch("/users/:id", {
//     input: { json: z.object({ name: z.string().optional() }) },
//     response: z.object({ id: z.string(), name: z.string() }),
//   }),
//   deleteUser: defineDelete("/users/:id", { response: z.void() }),
//   fileDownload: defineGet("/download/file", {
//     response: defineBinaryStream("application/octet-stream"),
//   }),
//   userStream: defineGet("/stream/users", {
//     response: defineJSONStream(z.object({ id: z.string(), name: z.string() })),
//   }),
//   notificationStream: defineGet("/events/notifications", {
//     input: { query: { userId: z.string() } },
//     response: defineSSE({
//       notification: z.object({ id: z.string(), message: z.string() }),
//     }),
//   }),
//   chatStream: defineGet("/chat", {
//     response: defineWebSocket(
//       [z.object({ id: z.string(), text: z.string() })],
//       [z.object({ text: z.string() })],
//     ),
//   }),
//   brokenJson: defineGet("/broken", { response: z.object({ data: z.string() }) }),
// };

// // --- GLOBAL HONO APP ---
// const app = new Hono();

// app.get("/api/v1/users/:id", (c) => c.json({ id: c.req.param("id"), name: "John Doe" }));
// app.get("/users", (c) => c.json([{ id: "1", name: "John" }]));
// app.post("/users", async (c) => {
//   const body = await c.req.json();
//   return c.json({ id: "new", ...body });
// });
// app.put("/users/:id", (c) =>
//   c.json({ id: c.req.param("id"), name: "Updated", updatedAt: "2023-01-01" }),
// );
// app.delete("/users/:id", (c) => c.body(null, 204));
// app.get("/download/file", (c) =>
//   stream(c, async (s) => {
//     await s.write(new Uint8Array([1, 2, 3]));
//   }),
// );
// app.get("/stream/users", (c) =>
//   stream(c, async (s) => {
//     await s.writeln(JSON.stringify({ id: "1", name: "John" }));
//   }),
// );
// app.get("/events/notifications", (c) =>
//   streamSSE(c, async (s) => {
//     await s.writeSSE({ event: "notification", data: JSON.stringify({ id: "1", message: "Hi" }) });
//   }),
// );
// app.get("/broken", (c) => c.text("{ invalid", { headers: { "Content-Type": "application/json" } }));

// // --- GLOBAL CLIENT SETUP ---
// const clientConfig = {
//   apiSchema: globalApiSchema,
//   baseURL: "http://localhost",
//   fetch: app.fetch,
//   alias: {
//     api: "/api/v1",
//   },
// };

// const client = createApiClient(clientConfig);

// // --- TEST SUITE ---
// describe("Unified API Client Test Suite (Flat Syntax)", () => {
//   describe("Standard CRUD", () => {
//     it("should handle basic GET with params and aliases", async () => {
//       const res = await client.get("/{api}/users/:id", {
//         param: { id: "123" },
//       });
//       expect(res.data?.id).toBe("123");
//       expect(res.data?.name).toBe("John Doe");
//     });

//     it("should handle POST with JSON body", async () => {
//       const res = await client.post("/users", {
//         json: { name: "Jane", email: "jane@test.com" },
//       });
//       expect(res.data?.name).toBe("Jane");
//       expect(res.data?.id).toBe("new");
//     });

//     it("should handle PUT with params and JSON body", async () => {
//       const res = await client.put("/users/:id", {
//         param: { id: "456" },
//         json: { name: "Jane Doe", email: "jane@example.com" },
//       });
//       expect(res.data?.updatedAt).toBe("2023-01-01");
//     });

//     it("should handle DELETE with params", async () => {
//       const res = await client.delete("/users/:id", {
//         param: { id: "789" },
//       });
//       expect(res.error).toBeUndefined();
//     });
//   });

//   describe("Streaming & Real-time", () => {
//     it("should handle binary streams", async () => {
//       const result = await client.get("/download/file");
//       const collected: number[] = [];
//       if (result.data) {
//         for await (const chunk of result.data) {
//           if (chunk.type === "binary") collected.push(...Array.from(chunk.data));
//         }
//       }
//       expect(collected).toEqual([1, 2, 3]);
//     });

//     it("should handle JSON (NDJSON) streams", async () => {
//       const result = await client.get("/stream/users");
//       const items: any[] = [];
//       if (result.data) {
//         for await (const chunk of result.data) {
//           if (chunk.type === "json") items.push(chunk.data);
//         }
//       }
//       expect(items[0].name).toBe("John");
//     });

//     it("should handle SSE (Server-Sent Events)", async () => {
//       const result = await client.get("/events/notifications", {
//         query: { userId: "123" },
//       });
//       if (result.data) {
//         for await (const chunk of result.data) {
//           if (chunk.type === "event" && chunk.name === "notification") {
//             expect(chunk.data.message).toBe("Hi");
//             break;
//           }
//         }
//       }
//     });
//   });

//   describe("WebSocket Functionality", () => {
//     beforeEach(() => {
//       global.WebSocket = MockWebSocket as any;
//     });

//     it("should connect and receive messages", async () => {
//       const result = await client.get("/chat");
//       if (result.data) {
//         setTimeout(() => {
//           MockWebSocket.lastInstance?.simulateMessage(
//             JSON.stringify({ id: "ws1", text: "Socket Message" }),
//           );
//           MockWebSocket.lastInstance?.close();
//         }, 10);

//         for await (const chunk of result.data) {
//           if (chunk.type === "message") {
//             expect(chunk.data.text).toBe("Socket Message");
//             break;
//           }
//         }
//       }
//     });
//   });

//   describe("Error Handling & orThrow()", () => {
//     it("should handle malformed JSON", async () => {
//       const res = await client.get("/broken");
//       expect(res.error).toBeInstanceOf(ApiError);
//     });

//     it("should throw via orThrow() pattern", async () => {
//       const data = await client
//         .get("/{api}/users/:id", {
//           param: { id: "123" },
//         })
//         .orThrow();
//       expect(data.name).toBe("John Doe");

//       await expect(client.get("/broken").orThrow()).rejects.toThrow(ApiError);
//     });

//     it("should execute interceptors correctly with flat syntax", async () => {
//       const order: string[] = [];
//       const localClient = createApiClient(clientConfig);
//       localClient.interceptors.request.use((_, o) => {
//         order.push("req");
//         return o;
//       });
//       localClient.interceptors.response.use((_, r) => {
//         order.push("res");
//         return r;
//       });

//       await localClient.get("/users");
//       expect(order).toEqual(["req", "res"]);
//     });
//   });

//   describe("Utilities", () => {
//     it("should correctly build URI strings", () => {
//       const uri = client.createEndpointUri("/{api}/users/:id", { id: "999" });
//       expect(uri).toBe("http://localhost/api/v1/users/999");
//     });
//   });
// });
