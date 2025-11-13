import type { z } from 'zod'
import type { MaybePromise } from './types'

type MaybeFn<T, C> =
  | (() => MaybePromise<T>)
  | ((args: C) => MaybePromise<T>)
  | T

type ArrayElementDescriptor<ElementType extends z.ZodType, C> = {
  length?: number
  min?: number
  max?: number
  faker: (
    args: C & {
      index: number
    },
  ) => MockStructure<ElementType, C>
}

export type MockStructure<T extends z.ZodType, C> = T extends z.ZodArray<
  // Array Type
  infer ElementType
>
  ? ElementType extends z.ZodType
    ?
        | MaybeFn<Array<MockStructure<ElementType, C>>, C>
        | ArrayElementDescriptor<ElementType, C>
    : ElementType
  : // Object Type
    T extends z.ZodObject<infer Shape>
    ? MaybeFn<
        | {
            [Key in keyof Shape]: Shape[Key] extends z.ZodType
              ? MockStructure<Shape[Key], C>
              : Shape[Key]
          }
        | z.infer<T>,
        C
      >
    : // Other Types
      MaybeFn<z.infer<T>, C>

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Loops through the mock structure, executing any functions (MaybeFn)
 * with the provided context, and recursively resolving object and array structures,
 * handling all Promises along the way.
 * @param mockStructure The mock structure containing functions or values.
 * @param context The context object to be passed to mock functions.
 * @returns A Promise that resolves to the final data conforming to the inferred type T.
 */
export async function createMock<T extends z.ZodType, C>(
  mockStructure: MockStructure<T, C>,
  context: C,
): Promise<z.infer<T>> {
  let currentValue: unknown

  // Resolve the current level's MaybeFn.
  if (typeof mockStructure === 'function') {
    currentValue = await mockStructure(context)
  } else {
    currentValue = mockStructure
  }

  // If the resolved value is null, undefined, or not an object,
  if (currentValue === null || typeof currentValue !== 'object') {
    return currentValue as z.infer<T>
  }

  // Check for Array Faker Configuration
  if ('faker' in currentValue && typeof currentValue.faker === 'function') {
    const config = currentValue as ArrayElementDescriptor<z.ZodType, C>

    let len = 0
    if (typeof config.length === 'number' && config.length >= 0) {
      len = config.length
    } else {
      const min =
        typeof config.min === 'number' && config.min >= 0 ? config.min : 1
      const max =
        typeof config.max === 'number' && config.max >= min ? config.max : 5
      len = getRandomInt(min, max)
    }

    const arrayPromises: Promise<any>[] = []

    for (let index = 0; index < len; index++) {
      const mockItem = config.faker({ ...context, index })
      const itemPromise = createMock(mockItem, context)
      arrayPromises.push(itemPromise)
    }

    return (await Promise.all(arrayPromises)) as z.infer<T>
  }

  // Recursively process Array
  if (Array.isArray(currentValue)) {
    const mockArray = currentValue as Array<MockStructure<z.ZodType, C>>
    const arrayPromises = mockArray.map((elementMockType) => {
      return createMock(elementMockType, context)
    })

    return (await Promise.all(arrayPromises)) as z.infer<T>
  }

  // Recursively process Object
  if (typeof currentValue === 'object' && currentValue !== null) {
    const mockObject = currentValue as Record<
      string,
      MockStructure<z.ZodType, C>
    >
    const result: Record<string, any> = {}

    const promises: Promise<any>[] = []
    const keys: string[] = []

    for (const key in mockObject) {
      if (Object.hasOwn(mockObject, key)) {
        const keyMockType = mockObject[key]
        const recursiveResult = createMock(keyMockType, context)
        promises.push(recursiveResult)
        keys.push(key)
      }
    }

    const resolvedValues = await Promise.all(promises)

    resolvedValues.forEach((value, index) => {
      result[keys[index]] = value
    })

    return result as z.infer<T>
  }

  return currentValue as z.infer<T>
}
