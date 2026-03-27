// ============================================================================
// mock-dash/db — Type-safe in-memory mock database for testing
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Core Collection Interface
// ---------------------------------------------------------------------------

/** Constraint for the dependency map passed to defineCollection */
type DepsMap = Record<string, Collection<Record<string, unknown>>>;

/**
 * Read-only collection reference — covariant in TData.
 * Used in join descriptors so that Collection<Specific> is assignable
 * to CollectionRef<Record<string, unknown>> via return-type covariance.
 */
export interface CollectionRef<TData extends Record<string, unknown>> {
  getData(): TData[];
}

/** A collection of in-memory records with a type-safe findMany query API */
export interface Collection<TData extends Record<string, unknown>> extends CollectionRef<TData> {
  /** Query records with optional filtering, projection, and joins */
  findMany<
    TSelect extends SelectQuery<TData> = Record<never, never>,
    const TJoin extends ReadonlyArray<JoinDescriptorUntyped> = [],
  >(
    options?: FindManyOptions<TData, TSelect, TJoin>,
  ): FindManyResult<TData, TSelect, TJoin>[];

  /** Insert one or more records into the collection */
  insert(data: TData | TData[]): TData[];

  /** Update records matching the where clause with the provided partial data */
  update(options: { where: WhereQuery<TData>; data: Partial<TData> }): TData[];

  /** Delete records matching the where clause, returning the deleted records */
  delete(options: { where: WhereQuery<TData> }): TData[];
}

// ---------------------------------------------------------------------------
// 2. Filter Operators
// ---------------------------------------------------------------------------

/** Base operators available for every field value */
interface BaseFilterOps<T> {
  eq?: T;
  inArray?: T[];
}

/** Numeric comparison operators */
interface NumericFilterOps {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

/** String pattern-matching operators */
interface StringFilterOps {
  like?: string;
  ilike?: string;
}

/**
 * Field-level filter operators — conditional on the value type.
 * Numbers get gt/gte/lt/lte; strings get like/ilike.
 */
type FilterOperators<T> = BaseFilterOps<T> &
  (T extends number ? NumericFilterOps : unknown) &
  (T extends string ? StringFilterOps : unknown);

// ---------------------------------------------------------------------------
// 3. Where Query (field-level + logical combinators)
// ---------------------------------------------------------------------------

/** Per-field filter conditions — implicitly AND'd */
type WhereFieldClause<T> = {
  [K in keyof T]?: FilterOperators<T[K]>;
};

/** Full where clause with logical operators */
type WhereQuery<T> = WhereFieldClause<T> & {
  AND?: WhereQuery<T>[];
  OR?: WhereQuery<T>[];
  NOT?: WhereQuery<T>;
};

// ---------------------------------------------------------------------------
// 4. Select (Projection)
// ---------------------------------------------------------------------------

/** Boolean projection map — pick fields by setting them to true */
type SelectQuery<T> = {
  [K in keyof T]?: true;
};

// ---------------------------------------------------------------------------
// 5. Join Descriptors
// ---------------------------------------------------------------------------

/** Join types supported by the engine */
type JoinType = "inner" | "left" | "right" | "full";

/**
 * Fully typed join descriptor preserving string-literal `as` and `type`.
 * TLocal = the queried collection's row type
 * TForeign = the joined collection's row type
 * TAs = string literal for the alias key
 * TType = literal join type
 */
interface JoinDescriptor<
  TLocal extends Record<string, unknown>,
  TForeign extends Record<string, unknown>,
  TAs extends string = string,
  TType extends JoinType = JoinType,
> {
  collection: CollectionRef<TForeign>;
  type: TType;
  on: {
    localField: keyof TLocal & string;
    foreignField: keyof TForeign & string;
  };
  as: TAs;
}

/** Loosely-typed join descriptor used as a generic constraint */
type JoinDescriptorUntyped = JoinDescriptor<
  Record<string, unknown>,
  Record<string, unknown>,
  string,
  JoinType
>;

// ---------------------------------------------------------------------------
// 6. OrderBy
// ---------------------------------------------------------------------------

/** Sort direction for a single field */
type OrderByClause<T> = { [K in keyof T]?: "asc" | "desc" };

// ---------------------------------------------------------------------------
// 7. FindMany Options
// ---------------------------------------------------------------------------

interface FindManyOptions<
  TData extends Record<string, unknown>,
  TSelect extends SelectQuery<TData>,
  TJoin extends ReadonlyArray<JoinDescriptorUntyped>,
> {
  where?: WhereQuery<TData>;
  select?: TSelect;
  join?: TJoin;
  orderBy?: OrderByClause<TData> | OrderByClause<TData>[];
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// 8. Computed Return Type
// ---------------------------------------------------------------------------

/**
 * Compute the joined fields contributed by a single join descriptor.
 * The nullability depends on the join type:
 * - inner: foreign is always present
 * - left: foreign may be null (unmatched local rows)
 * - right: foreign is always present
 * - full: foreign may be null
 */
type SingleJoinField<J> =
  J extends JoinDescriptor<Record<string, unknown>, infer TForeign, infer TAs, infer TType>
    ? TType extends "inner"
      ? { [K in TAs]: TForeign }
      : TType extends "left"
        ? { [K in TAs]: TForeign | null }
        : TType extends "right"
          ? { [K in TAs]: TForeign }
          : TType extends "full"
            ? { [K in TAs]: TForeign | null }
            : { [K in TAs]: TForeign | null }
    : unknown;

/**
 * Recursively intersect all join field contributions from a tuple of
 * join descriptors.
 */
type ComputeJoinFields<TJoins extends ReadonlyArray<JoinDescriptorUntyped>> =
  TJoins extends readonly [
    infer Head extends JoinDescriptorUntyped,
    ...infer Tail extends ReadonlyArray<JoinDescriptorUntyped>,
  ]
    ? SingleJoinField<Head> & ComputeJoinFields<Tail>
    : unknown; // identity for intersection

/**
 * Detect whether any join in the tuple is a right or full join.
 * If so, the base row type must be Partial<TData>.
 */
type HasRightOrFull<TJoins extends ReadonlyArray<JoinDescriptorUntyped>> = TJoins extends readonly [
  infer Head extends JoinDescriptorUntyped,
  ...infer Tail extends ReadonlyArray<JoinDescriptorUntyped>,
]
  ? Head extends JoinDescriptor<
      Record<string, unknown>,
      Record<string, unknown>,
      string,
      infer TType
    >
    ? TType extends "right" | "full"
      ? true
      : HasRightOrFull<Tail>
    : HasRightOrFull<Tail>
  : false;

/**
 * Compute the base row type. If any right/full join exists, local fields
 * become optional (Partial) because unmatched foreign rows won't have them.
 */
type BaseRow<
  TData extends Record<string, unknown>,
  TJoins extends ReadonlyArray<JoinDescriptorUntyped>,
> = HasRightOrFull<TJoins> extends true ? Partial<TData> : TData;

/**
 * Apply select projection. If TSelect has no keys (Record<never, never>),
 * return the full row. Otherwise, pick only the selected keys.
 */
type ApplySelect<TRow extends Record<string, unknown>, TSelect> = keyof TSelect extends never
  ? TRow
  : Pick<TRow, Extract<keyof TSelect, keyof TRow>>;

/** The final computed result type for findMany. */
type FindManyResult<
  TData extends Record<string, unknown>,
  TSelect extends SelectQuery<TData>,
  TJoins extends ReadonlyArray<JoinDescriptorUntyped>,
> = ApplySelect<BaseRow<TData, TJoins> & ComputeJoinFields<TJoins>, TSelect>;

// ---------------------------------------------------------------------------
// 9. defineCollection Configuration
// ---------------------------------------------------------------------------

interface CollectionConfig<TData extends Record<string, unknown>, TDeps extends DepsMap> {
  name: string;
  schema: unknown; // Schema-library-agnostic; TData is inferred from initData
  dependencies?: TDeps;
  initData: (deps: TDeps) => TData[];
}

// ---------------------------------------------------------------------------
// 10. Runtime Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a SQL-style wildcard pattern (using %) to a RegExp.
 * Escapes all regex-special characters, then replaces % with .*.
 */
function wildcardToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === "%" ? "%" : `\\${ch}`));
  const regexStr = `^${escaped.replaceAll("%", ".*")}$`;
  return new RegExp(regexStr, caseInsensitive ? "i" : "");
}

/**
 * Test a single field value against a set of filter operators.
 * All operators on the same field are AND'd (all must pass).
 */
function matchFieldOperators(value: unknown, ops: Record<string, unknown>): boolean {
  for (const [op, operand] of Object.entries(ops)) {
    switch (op) {
      case "eq":
        if (value !== operand) return false;
        break;
      case "inArray":
        if (Array.isArray(operand)) {
          if (!operand.includes(value)) return false;
        }
        break;
      case "gt":
        if (typeof value !== "number" || typeof operand !== "number") return false;
        if (!(value > operand)) return false;
        break;
      case "gte":
        if (typeof value !== "number" || typeof operand !== "number") return false;
        if (!(value >= operand)) return false;
        break;
      case "lt":
        if (typeof value !== "number" || typeof operand !== "number") return false;
        if (!(value < operand)) return false;
        break;
      case "lte":
        if (typeof value !== "number" || typeof operand !== "number") return false;
        if (!(value <= operand)) return false;
        break;
      case "like":
        if (typeof operand !== "string") return false;
        if (!wildcardToRegex(operand, false).test(String(value))) return false;
        break;
      case "ilike":
        if (typeof operand !== "string") return false;
        if (!wildcardToRegex(operand, true).test(String(value))) return false;
        break;
    }
  }
  return true;
}

/**
 * Test a record against a full WhereQuery (field-level + logical combinators).
 * Root-level field conditions are implicitly AND'd together with any
 * AND/OR/NOT clauses.
 */
function matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;

    if (key === "AND") {
      if (!Array.isArray(condition)) return false;
      for (const sub of condition) {
        if (
          typeof sub === "object" &&
          sub !== null &&
          !matchesWhere(record, sub as Record<string, unknown>)
        ) {
          return false;
        }
      }
      continue;
    }

    if (key === "OR") {
      if (!Array.isArray(condition)) return false;
      let anyMatch = false;
      for (const sub of condition) {
        if (
          typeof sub === "object" &&
          sub !== null &&
          matchesWhere(record, sub as Record<string, unknown>)
        ) {
          anyMatch = true;
          break;
        }
      }
      if (!anyMatch) return false;
      continue;
    }

    if (key === "NOT") {
      if (
        typeof condition === "object" &&
        condition !== null &&
        matchesWhere(record, condition as Record<string, unknown>)
      ) {
        return false;
      }
      continue;
    }

    // Field-level filter
    if (typeof condition === "object" && condition !== null) {
      const fieldValue = record[key];
      if (!matchFieldOperators(fieldValue, condition as Record<string, unknown>)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Apply select projection to an array of records.
 * If no select is provided, returns records unchanged.
 */
function applySelect(
  records: Record<string, unknown>[],
  select: Record<string, true> | undefined,
): Record<string, unknown>[] {
  if (!select || Object.keys(select).length === 0) return records;
  return records.map((record) => {
    const projected: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
      if (key in record) {
        projected[key] = record[key];
      }
    }
    return projected;
  });
}

/**
 * Sort an array of records by one or more orderBy clauses.
 * Clones the array first to avoid mutating the original.
 */
function applyOrderBy(
  records: Record<string, unknown>[],
  orderBy: Record<string, string> | Record<string, string>[],
): Record<string, unknown>[] {
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  const sorted = [...records];
  sorted.sort((a, b) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal === bVal) continue;
        const multiplier = direction === "desc" ? -1 : 1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return (aVal - bVal) * multiplier;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return aVal.localeCompare(bVal) * multiplier;
        }
        // Fallback: coerce to string for comparison
        return String(aVal).localeCompare(String(bVal)) * multiplier;
      }
    }
    return 0;
  });
  return sorted;
}

/**
 * Perform joins on local data against foreign collections.
 * Supports inner, left, right, and full join types.
 * Joins are chained — each join's output feeds into the next.
 */
function performJoins(
  localData: Record<string, unknown>[],
  joins: JoinDescriptorUntyped[],
): Record<string, unknown>[] {
  let result = localData;

  for (const join of joins) {
    const foreignData = join.collection.getData();
    const { localField, foreignField } = join.on;
    const alias = join.as;

    // Build a lookup map: foreignField value → foreign records
    const foreignMap = new Map<unknown, Record<string, unknown>[]>();
    for (const fRow of foreignData) {
      const fKey = (fRow as Record<string, unknown>)[foreignField];
      const existing = foreignMap.get(fKey);
      if (existing) {
        existing.push(fRow as Record<string, unknown>);
      } else {
        foreignMap.set(fKey, [fRow as Record<string, unknown>]);
      }
    }

    const joined: Record<string, unknown>[] = [];

    switch (join.type) {
      case "inner": {
        for (const lRow of result) {
          const lKey = lRow[localField];
          const matches = foreignMap.get(lKey);
          if (matches) {
            for (const fRow of matches) {
              joined.push({ ...lRow, [alias]: { ...fRow } });
            }
          }
        }
        break;
      }

      case "left": {
        for (const lRow of result) {
          const lKey = lRow[localField];
          const matches = foreignMap.get(lKey);
          if (matches) {
            for (const fRow of matches) {
              joined.push({ ...lRow, [alias]: { ...fRow } });
            }
          } else {
            joined.push({ ...lRow, [alias]: null });
          }
        }
        break;
      }

      case "right": {
        const matchedForeignKeys = new Set<unknown>();
        for (const lRow of result) {
          const lKey = lRow[localField];
          const matches = foreignMap.get(lKey);
          if (matches) {
            matchedForeignKeys.add(lKey);
            for (const fRow of matches) {
              joined.push({ ...lRow, [alias]: { ...fRow } });
            }
          }
        }
        // Add unmatched foreign rows (no local fields)
        for (const fRow of foreignData) {
          const fKey = (fRow as Record<string, unknown>)[foreignField];
          if (!matchedForeignKeys.has(fKey)) {
            joined.push({ [alias]: { ...fRow } });
          }
        }
        break;
      }

      case "full": {
        const matchedForeignKeys = new Set<unknown>();
        for (const lRow of result) {
          const lKey = lRow[localField];
          const matches = foreignMap.get(lKey);
          if (matches) {
            matchedForeignKeys.add(lKey);
            for (const fRow of matches) {
              joined.push({ ...lRow, [alias]: { ...fRow } });
            }
          } else {
            joined.push({ ...lRow, [alias]: null });
          }
        }
        // Add unmatched foreign rows
        for (const fRow of foreignData) {
          const fKey = (fRow as Record<string, unknown>)[foreignField];
          if (!matchedForeignKeys.has(fKey)) {
            joined.push({ [alias]: { ...fRow } });
          }
        }
        break;
      }
    }

    result = joined;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 11. defineCollection Factory
// ---------------------------------------------------------------------------

/**
 * Define an in-memory collection with a type-safe findMany query API.
 *
 * @param config - Collection configuration including name, schema, optional
 *   dependencies, and an initData factory that produces the seed records.
 * @returns A Collection<TData> with getData() and findMany() methods.
 */
export function defineCollection<
  TData extends Record<string, unknown>,
  TDeps extends DepsMap = Record<never, never>,
>(config: CollectionConfig<TData, TDeps>): Collection<TData> {
  // Seed the collection data. The empty-object cast is the one justified `as`
  // — TypeScript cannot narrow {} to a generic default Record<never, never>.
  const deps: TDeps = config.dependencies ?? ({} as TDeps);
  const data: TData[] = config.initData(deps);

  return {
    getData(): TData[] {
      return data;
    },

    findMany<
      TSelect extends SelectQuery<TData> = Record<never, never>,
      const TJoin extends ReadonlyArray<JoinDescriptorUntyped> = [],
    >(options?: FindManyOptions<TData, TSelect, TJoin>): FindManyResult<TData, TSelect, TJoin>[] {
      if (!options) {
        return data as unknown as FindManyResult<TData, TSelect, TJoin>[];
      }

      const { where, select, join, orderBy, limit, offset } = options;

      // Pipeline: Join → Where → OrderBy → Offset → Limit → Select
      let records: Record<string, unknown>[] = data;

      // 1. Joins (expand dataset)
      if (join && join.length > 0) {
        records = performJoins(records, join as unknown as JoinDescriptorUntyped[]);
      }

      // 2. Where (filter)
      if (where) {
        records = records.filter((record) =>
          matchesWhere(record, where as unknown as Record<string, unknown>),
        );
      }

      // 3. OrderBy (sort — clones internally)
      if (orderBy) {
        records = applyOrderBy(
          records,
          orderBy as unknown as Record<string, string> | Record<string, string>[],
        );
      }

      // 4. Offset (skip)
      if (typeof offset === "number" && offset > 0) {
        records = records.slice(offset);
      }

      // 5. Limit (truncate)
      if (typeof limit === "number" && limit >= 0) {
        records = records.slice(0, limit);
      }

      // 6. Select (project)
      if (select && Object.keys(select).length > 0) {
        records = applySelect(records, select as unknown as Record<string, true>);
      }

      // The runtime produces Record<string, unknown>[]; cast to the computed
      // generic return type at the boundary.
      return records as unknown as FindManyResult<TData, TSelect, TJoin>[];
    },

    insert(input: TData | TData[]): TData[] {
      const records = Array.isArray(input) ? input : [input];
      data.push(...records);
      return records;
    },

    update(options: { where: WhereQuery<TData>; data: Partial<TData> }): TData[] {
      const updated: TData[] = [];
      for (const record of data) {
        if (
          matchesWhere(
            record as Record<string, unknown>,
            options.where as unknown as Record<string, unknown>,
          )
        ) {
          Object.assign(record, options.data);
          updated.push(record);
        }
      }
      return updated;
    },

    delete(options: { where: WhereQuery<TData> }): TData[] {
      const deleted: TData[] = [];
      const remaining: TData[] = [];
      for (const record of data) {
        if (
          matchesWhere(
            record as Record<string, unknown>,
            options.where as unknown as Record<string, unknown>,
          )
        ) {
          deleted.push(record);
        } else {
          remaining.push(record);
        }
      }
      data.length = 0;
      data.push(...remaining);
      return deleted;
    },
  };
}
