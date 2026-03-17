import { Schema } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { defineCollection, createDB } from './index.js';

const roleEnum = ['ADMIN', 'EDITOR', 'VIEWER'] as const;

const roleSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const userSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  roles: Schema.Array(roleSchema),
});

const roleCollection = defineCollection({
  name: 'Roles',
  schema: Schema.standardSchemaV1(roleSchema),
  dependencies: {
    faker: import('@faker-js/faker').then(({ faker }) => faker),
  },
  initData: ({ faker }) =>
    roleEnum.map((role) => ({
      id: faker.string.uuid(),
      name: role,
    })),
});

const userCollection = defineCollection({
  name: 'Users',
  dependencies: {
    roles: roleCollection,
  },
  schema: Schema.standardSchemaV1(userSchema),
  initData: async ({ roles }) => {
    const allRoles = await roles.findAll();
    return [
      {
        id: 'user_1',
        name: 'Alice',
        roles: allRoles.filter(
          (role) => role.name === 'ADMIN' || role.name === 'EDITOR',
        ),
      },
      {
        id: 'user_2',
        name: 'Bob',
        roles: allRoles.filter((role) => role.name === 'VIEWER'),
      },
    ];
  },
});

describe('db query shape', () => {
  it('find all users with their roles', async () => {
    const db = createDB({
      collections: [roleCollection, userCollection],
    });

    const users = await db.users.findAll();
    expect(users).toEqual([
      {
        id: 'user_1',
        name: 'Alice',
        roles: [
          expect.objectContaining({ name: 'ADMIN' }),
          expect.objectContaining({ name: 'EDITOR' }),
        ],
      },
      {
        id: 'user_2',
        name: 'Bob',
        roles: [expect.objectContaining({ name: 'VIEWER' })],
      },
    ]);
  });

  it('should throw a validation error if initData returns invalid shapes', async () => {
    const invalidCollection = defineCollection({
      name: 'BadData',
      schema: Schema.standardSchemaV1(userSchema),
      initData: () => [{ id: 1, name: 123 }] as any, // Incorrect types
    });

    const db = createDB({ collections: [invalidCollection] });

    // This is where Effect.Schema shines
    await expect(db.badData.findAll()).rejects.toThrow();
  });
});
