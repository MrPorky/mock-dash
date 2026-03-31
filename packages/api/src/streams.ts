import type { StandardSchemaV1 } from "@standard-schema/spec";

import { ValidationError } from "./errors.ts";

/**
 * Read a binary stream, yielding { type: 'binary', data: Uint8Array } chunks.
 */
export async function* readBinaryStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: "binary"; data: Uint8Array }> {
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        yield { type: "binary", data: value };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read a newline-delimited JSON stream. Each line is parsed and validated.
 * Validation errors are surfaced as { type: 'error' } chunks; the stream continues.
 */
export async function* readJSONStream<S extends StandardSchemaV1>(
  body: ReadableStream<Uint8Array>,
  schema: S,
): AsyncGenerator<
  { type: "json"; data: StandardSchemaV1.InferOutput<S> } | { type: "error"; error: Error }
> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          yield {
            type: "error",
            error: new Error(`Invalid JSON in stream: ${(e as Error).message}`),
          };
          continue;
        }

        const result = await schema["~standard"].validate(parsed);
        if ("issues" in result && result.issues) {
          yield {
            type: "error",
            error: new ValidationError(
              "Stream item validation failed",
              result.issues.map((i) => ({
                message: i.message,
                path: i.path?.map((p) =>
                  typeof p === "object" && p !== null && "key" in p ? p.key : p,
                ) as PropertyKey[] | undefined,
              })),
            ),
          };
        } else {
          yield { type: "json", data: result.value as StandardSchemaV1.InferOutput<S> };
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(buffer.trim());
      } catch (e) {
        yield {
          type: "error",
          error: new Error(`Invalid JSON in stream: ${(e as Error).message}`),
        };
        return;
      }

      const result = await schema["~standard"].validate(parsed);
      if ("issues" in result && result.issues) {
        yield {
          type: "error",
          error: new ValidationError(
            "Stream item validation failed",
            result.issues.map((i) => ({
              message: i.message,
              path: i.path?.map((p) =>
                typeof p === "object" && p !== null && "key" in p ? p.key : p,
              ) as PropertyKey[] | undefined,
            })),
          ),
        };
      } else {
        yield { type: "json", data: result.value as StandardSchemaV1.InferOutput<S> };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read a Server-Sent Events stream. Parses `event:` and `data:` lines.
 * Named events are validated against the corresponding schema from the events map.
 */
export async function* readSSEStream(
  body: ReadableStream<Uint8Array>,
  eventSchemas: Record<string, StandardSchemaV1>,
): AsyncGenerator<
  { type: "event"; name: string; data: unknown } | { type: "error"; error: Error }
> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "") {
          // Empty line → dispatch event
          if (currentData) {
            yield* dispatchSSEEvent(currentEvent, currentData, eventSchemas);
          }
          currentEvent = "";
          currentData = "";
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          currentData = trimmed.slice(5).trim();
        }
      }
    }

    // Flush any pending event at end of stream
    if (currentData) {
      yield* dispatchSSEEvent(currentEvent, currentData, eventSchemas);
    }
  } finally {
    reader.releaseLock();
  }
}

async function* dispatchSSEEvent(
  eventName: string,
  rawData: string,
  eventSchemas: Record<string, StandardSchemaV1>,
): AsyncGenerator<
  { type: "event"; name: string; data: unknown } | { type: "error"; error: Error }
> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    yield { type: "error", error: new Error(`Invalid JSON in SSE data: ${rawData}`) };
    return;
  }

  if (eventName && eventSchemas[eventName]) {
    const result = await eventSchemas[eventName]["~standard"].validate(parsed);
    if ("issues" in result && result.issues) {
      yield {
        type: "error",
        error: new ValidationError(
          `SSE event "${eventName}" validation failed`,
          result.issues.map((i) => ({
            message: i.message,
            path: i.path?.map((p) =>
              typeof p === "object" && p !== null && "key" in p ? p.key : p,
            ) as PropertyKey[] | undefined,
          })),
        ),
      };
    } else {
      yield { type: "event", name: eventName, data: result.value };
    }
  } else if (eventName) {
    // Named event without matching schema — pass through
    yield { type: "event", name: eventName, data: parsed };
  } else {
    // Unnamed event — error
    yield { type: "error", error: new Error("SSE event without event name") };
  }
}
