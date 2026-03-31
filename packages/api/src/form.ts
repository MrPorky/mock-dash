import type { StandardSchemaV1 } from "@standard-schema/spec";

import { ValidationError } from "./errors.ts";

/**
 * Flatten a nested object into dot-notation and bracket-indexed entries.
 *
 * Examples:
 *   { address: { street: "123" } } → [["address.street", "123"]]
 *   { items: [{ name: "A" }] } → [["items[0].name", "A"]]
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Array<[string, string | Blob]> {
  const entries: Array<[string, string | Blob]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value instanceof Blob) {
      entries.push([fullKey, value]);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && typeof item === "object" && !(item instanceof Blob)) {
          entries.push(...flattenObject(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          entries.push([`${key}[${i}]`, String(item)]);
        }
      }
    } else if (value !== null && typeof value === "object") {
      entries.push(...flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      entries.push([fullKey, value === undefined ? "" : String(value)]);
    }
  }

  return entries;
}

/**
 * Convert a plain object to a FormData instance, flattening nested structures.
 */
export function objectToFormData(obj: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of flattenObject(obj)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * Parse a FormData instance back into a nested JS object.
 * Handles dot-notation keys (a.b.c) and bracket-indexed keys (items[0].name).
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    setNestedValue(result, key, value);
  }

  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  // Split on dots and brackets: "items[0].name" → ["items", "0", "name"]
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current: Record<string, unknown> | unknown[] = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextNumeric = /^\d+$/.test(nextPart);

    const container = current as Record<string, unknown>;
    if (container[part] === undefined) {
      container[part] = isNextNumeric ? [] : {};
    }
    current = container[part] as Record<string, unknown> | unknown[];
  }

  const lastPart = parts[parts.length - 1];
  (current as Record<string, unknown>)[lastPart] = value;
}

/**
 * Validate form input data against the field schemas.
 * Accepts either a plain object or a native FormData instance.
 * Returns the validated data as a FormData for sending, or a ValidationError.
 */
export async function validateFormInput(
  data: Record<string, unknown> | FormData,
  fieldSchemas: Record<string, StandardSchemaV1>,
): Promise<{ valid: true; formData: FormData } | { valid: false; error: ValidationError }> {
  // Convert FormData to plain object for validation
  let plainObj: Record<string, unknown>;
  if (data instanceof FormData) {
    plainObj = formDataToObject(data);
  } else {
    plainObj = data;
  }

  // Validate each field
  const issues: Array<{ message: string; path?: ReadonlyArray<PropertyKey> }> = [];
  const validated: Record<string, unknown> = {};

  for (const [fieldName, schema] of Object.entries(fieldSchemas)) {
    const fieldValue = plainObj[fieldName];
    const result = await schema["~standard"].validate(fieldValue);

    if ("issues" in result && result.issues) {
      for (const issue of result.issues) {
        issues.push({
          message: issue.message,
          path: [
            fieldName,
            ...(issue.path?.map((p) =>
              typeof p === "object" && p !== null && "key" in p ? p.key : p,
            ) ?? []),
          ],
        });
      }
    } else {
      validated[fieldName] = result.value;
    }
  }

  if (issues.length > 0) {
    return { valid: false, error: new ValidationError("Form validation failed", issues) };
  }

  // Build FormData from validated data
  const formData = data instanceof FormData ? data : objectToFormData(validated);
  return { valid: true, formData };
}
