import type { StandardSchemaV1 } from "@standard-schema/spec";

import { NetworkError, ValidationError } from "./errors.ts";
import type { WebSocketController } from "./types.ts";

type WSChunk =
  | { type: "status"; status: "connecting" | "open" | "closed" }
  | { type: "message"; data: unknown }
  | { type: "binary"; data: ArrayBuffer | Blob | SharedArrayBuffer }
  | { type: "error"; error: Error };

/**
 * Connect to a WebSocket endpoint and return an async iterable stream + controller.
 *
 * Converts http/https → ws/wss in the URL.
 */
export function connectWebSocket(
  url: string,
  serverSchemas: StandardSchemaV1[],
  _signal?: AbortSignal,
): { stream: AsyncIterable<WSChunk>; controller: WebSocketController } {
  // Convert protocol
  const wsUrl = url.replace(/^http(s?):\/\//, "ws$1://");

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    throw new NetworkError("WebSocket connection failed", err instanceof Error ? err : undefined);
  }

  // Queue for push-based → pull-based bridging
  const queue: WSChunk[] = [];
  let resolve: ((value: IteratorResult<WSChunk, undefined>) => void) | null = null;
  let done = false;

  function push(chunk: WSChunk) {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r({ value: chunk, done: false });
    } else {
      queue.push(chunk);
    }
  }

  function finish() {
    done = true;
    if (resolve) {
      const r = resolve;
      resolve = null;
      r({ value: undefined, done: true });
    }
  }

  // Start with connecting status
  push({ type: "status", status: "connecting" });

  ws.addEventListener("open", () => {
    push({ type: "status", status: "open" });
  });

  ws.addEventListener("message", (event: MessageEvent) => {
    const { data } = event;

    // Binary messages
    if (data instanceof ArrayBuffer) {
      push({ type: "binary", data });
      return;
    }
    if (data instanceof Blob) {
      push({ type: "binary", data });
      return;
    }
    if (typeof data !== "string") {
      // TypedArray, DataView, etc.
      if (ArrayBuffer.isView(data)) {
        push({
          type: "binary",
          data: data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          ) as ArrayBuffer,
        });
        return;
      }
      push({ type: "binary", data: data as ArrayBuffer });
      return;
    }

    // String messages → JSON parse + validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      push({
        type: "error",
        error: new Error(`Invalid JSON in WebSocket message: ${data}`),
      });
      return;
    }

    // Try to validate against server schemas
    void validateWSMessage(parsed, serverSchemas).then((result) => {
      if (result.valid) {
        push({ type: "message", data: result.data });
      } else {
        push({ type: "error", error: result.error });
      }
    });
  });

  ws.addEventListener("error", () => {
    push({ type: "error", error: new Error("WebSocket error occurred") });
  });

  ws.addEventListener("close", () => {
    push({ type: "status", status: "closed" });
    finish();
  });

  const stream: AsyncIterable<WSChunk> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<WSChunk, undefined>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((r) => {
            resolve = r;
          });
        },
      };
    },
  };

  const controller: WebSocketController = {
    send(data: unknown) {
      ws.send(JSON.stringify(data));
    },
    sendRaw(data: string) {
      ws.send(data);
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
    get readyState() {
      return ws.readyState;
    },
  };

  return { stream, controller };
}

async function validateWSMessage(
  parsed: unknown,
  schemas: StandardSchemaV1[],
): Promise<{ valid: true; data: unknown } | { valid: false; error: Error }> {
  // Try each schema, return first successful validation
  for (const schema of schemas) {
    const result = await schema["~standard"].validate(parsed);
    if (!("issues" in result) || !result.issues) {
      return { valid: true, data: result.value };
    }
  }

  // All schemas failed
  const lastResult = await schemas[schemas.length - 1]?.["~standard"].validate(parsed);
  if (lastResult && "issues" in lastResult && lastResult.issues) {
    return {
      valid: false,
      error: new ValidationError(
        "WebSocket message validation failed",
        lastResult.issues.map((i) => ({
          message: i.message,
          path: i.path?.map((p) =>
            typeof p === "object" && p !== null && "key" in p ? p.key : p,
          ) as PropertyKey[] | undefined,
        })),
      ),
    };
  }

  return { valid: false, error: new Error("WebSocket message validation failed") };
}
