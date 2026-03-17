import type { StandardSchemaV1 } from '@standard-schema/spec';

// ------------------------------------------------------------------
// 1. Type Definitions
// ------------------------------------------------------------------

export interface CollectionApi<T> {
  findAll: () => Promise<ReadonlyArray<T>>;
}

// Unwraps Promises and Collections so `initData` gets the exact resolved values
type ResolvedDeps<Deps extends Record<string, any>> = {
  [K in keyof Deps]: Deps[K] extends Promise<infer U>
    ? U // Unwraps import() to the actual module (e.g., Faker)
    : Deps[K] extends CollectionDef<any, infer Output, any>
      ? CollectionApi<Output> // Unwraps a Collection dependency to its API
      : Deps[K];
};

// The core configuration object. Notice `Output` is inferred from the StandardSchema
export interface CollectionDef<
  Name extends string,
  Output,
  Deps extends Record<string, any>,
> {
  name: Name;
  schema: StandardSchemaV1<any, Output>;
  dependencies?: Deps;
  // initData forces you to return exactly what the schema outputs
  initData: (deps: ResolvedDeps<Deps>) => Output[] | Promise<Output[]>;
}

// Maps the Array of Collections into an Object with lowercase keys (db.users)
type CreateDBResult<
  Collections extends ReadonlyArray<CollectionDef<any, any, any>>,
> = {
  [C in Collections[number] as Uncapitalize<C['name']>]: CollectionApi<
    C extends CollectionDef<any, infer Output, any> ? Output : never
  >;
};

// ------------------------------------------------------------------
// 2. The Functions
// ------------------------------------------------------------------

// Identity function for strict TypeScript autocomplete
export const defineCollection = <
  Name extends string,
  Output,
  Deps extends Record<string, any> = {},
>(
  config: CollectionDef<Name, Output, Deps>,
): CollectionDef<Name, Output, Deps> => {
  return config;
};

export const createDB = <
  const Collections extends ReadonlyArray<CollectionDef<any, any, any>>,
>(config: {
  collections: Collections;
}) => {
  const store = new Map<string, any[]>();
  const initPromises = new Map<string, Promise<any[]>>();

  const db: any = {};

  const getCollectionData = async (
    col: CollectionDef<any, any, any>,
  ): Promise<any[]> => {
    if (store.has(col.name)) return store.get(col.name)!;
    if (initPromises.has(col.name)) return initPromises.get(col.name)!;

    const initPromise = (async () => {
      const resolvedDeps: Record<string, any> = {};

      // 1. Resolve Dependencies (Handles Graph logic)
      if (col.dependencies) {
        for (const [key, dep] of Object.entries(col.dependencies)) {
          if (dep instanceof Promise) {
            resolvedDeps[key] = await dep;
          } else if (dep && typeof dep === 'object' && 'name' in dep) {
            const depData = await getCollectionData(dep as any);
            resolvedDeps[key] = { findAll: async () => depData };
          } else {
            resolvedDeps[key] = dep;
          }
        }
      }

      // 2. Generate Raw Data
      const rawData = await col.initData(resolvedDeps as any);

      // 3. Standard Schema Validation
      const validatedData = [];
      for (const item of rawData) {
        // This is the magic of Standard Schema. It works with Effect, Zod, Valibot, etc.
        const result = await col.schema['~standard'].validate(item);

        if (result.issues) {
          throw new Error(
            `[MockDB Validation Error in '${col.name}']: ` +
              JSON.stringify(result.issues, null, 2),
          );
        }
        validatedData.push(result.value);
      }

      store.set(col.name, validatedData);
      return validatedData;
    })();

    initPromises.set(col.name, initPromise);
    return initPromise;
  };

  for (const col of config.collections) {
    const key = col.name.charAt(0).toLowerCase() + col.name.slice(1);
    db[key] = {
      findAll: () => getCollectionData(col),
    };
  }

  return db as CreateDBResult<Collections>;
};
