import { describe, it, expect, beforeEach } from "vite-plus/test";
import { type Collection, defineCollection } from "../src/index.ts";
import { z } from "zod";

describe("mock-dash/db Query Builder", () => {
  let roles: Collection<{
    id: string;
    name: string;
  }>;
  let users: Collection<{
    id: string;
    name: string;
    age: number;
    roleId: string;
    email: string;
  }>;

  beforeEach(() => {
    // 1. Define Schemas
    const roleModel = z.object({
      id: z.string(),
      name: z.string(),
    });

    const userModel = z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
      roleId: z.string(),
      email: z.string(),
    });

    // 2. Initialize Data Collections
    roles = defineCollection({
      name: "roles",
      schema: roleModel,
      initData: () => [
        { id: "1", name: "ADMIN" },
        { id: "2", name: "EDITOR" },
        { id: "3", name: "VIEWER" },
        { id: "4", name: "GUEST" }, // No users have this role (useful for right/full joins)
      ],
    });

    users = defineCollection({
      name: "users",
      dependencies: { roles },
      schema: userModel,
      initData: () => [
        { id: "1", name: "Alice", age: 25, roleId: "1", email: "alice@gmail.com" },
        { id: "2", name: "Bob", age: 30, roleId: "2", email: "bob@yahoo.com" },
        { id: "3", name: "Charlie", age: 18, roleId: "3", email: "charlie@GMAIL.COM" },
        { id: "4", name: "Dave", age: 40, roleId: "999", email: "dave@test.com" }, // Invalid roleId (useful for left/inner joins)
      ],
    });
  });

  describe("Query Filtering and Joins", () => {
    describe("Field-Level Operators", () => {
      it('should filter using "eq" and "inArray"', () => {
        const result = users.findMany({
          where: {
            roleId: { inArray: ["1", "2"] }, // Alice and Bob
          },
        });
        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Bob"]);
      });

      it('should filter using numeric operators "gt", "gte", "lt", "lte"', () => {
        const result = users.findMany({
          where: {
            age: { gt: 18, lte: 30 }, // Alice (25) and Bob (30). Charlie is exactly 18.
          },
        });
        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Bob"]);
      });

      it('should filter using string operators "like" and "ilike"', () => {
        // 'ilike' should be case-insensitive, matching 'alice@gmail.com' and 'charlie@GMAIL.COM'
        const result = users.findMany({
          where: {
            email: { ilike: "%@gmail.com" },
          },
        });
        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Charlie"]);

        // 'like' is case-sensitive, so it should only match Bob
        const resultLike = users.findMany({
          where: {
            email: { like: "%@yahoo.com" },
          },
        });
        expect(resultLike).toHaveLength(1);
        expect(resultLike[0].name).toBe("Bob");
      });
    });

    describe("Logical Operators", () => {
      it("should filter using logical OR", () => {
        const result = users.findMany({
          where: {
            OR: [
              { age: { gt: 35 } }, // Dave (40)
              { roleId: { eq: "1" } }, // Alice (ADMIN)
            ],
          },
        });
        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Dave"]);
      });

      it("should filter using logical AND combined with NOT", () => {
        const result = users.findMany({
          where: {
            AND: [
              { age: { gte: 25 } }, // Alice (25), Bob (30), Dave (40)
              { NOT: { email: { like: "%test.com" } } }, // Excludes Dave
            ],
          },
        });
        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Bob"]);
      });
    });

    describe("Projection (Select)", () => {
      it("should only return selected fields", () => {
        const result = users.findMany({
          select: {
            id: true,
            name: true,
          },
          where: {
            id: { eq: "1" },
          },
        });
        expect(result).toHaveLength(1);
        // Ensure other fields like 'age', 'roleId', and 'email' are stripped out
        expect(result[0]).toEqual({ id: "1", name: "Alice" });
      });
    });

    describe("Relational Joins", () => {
      it("should perform an INNER JOIN", () => {
        const result = users.findMany({
          join: [
            {
              collection: roles,
              type: "inner",
              on: { localField: "roleId", foreignField: "id" },
              as: "roleData",
            },
          ],
        });
        // Dave drops out because his roleId (999) doesn't exist.
        // GUEST role drops out because no user has it.
        expect(result).toHaveLength(3);
        expect(result.map((u) => u.name)).toEqual(["Alice", "Bob", "Charlie"]);
        expect(result[0].roleData.name).toBe("ADMIN");
      });

      it("should perform a LEFT JOIN", () => {
        const result = users.findMany({
          join: [
            {
              collection: roles,
              type: "left",
              on: { localField: "roleId", foreignField: "id" },
              as: "roleData",
            },
          ],
        });
        // All 4 users should be returned. Dave will have a null roleData.
        expect(result).toHaveLength(4);
        const dave = result.find((u) => u.name === "Dave");
        if (!dave) {
          throw new Error("Expected Dave record");
        }
        expect(dave.roleData).toBeNull();
      });

      it("should perform a RIGHT JOIN", () => {
        const result = users.findMany({
          join: [
            {
              collection: roles,
              type: "right",
              on: { localField: "roleId", foreignField: "id" },
              as: "roleData",
            },
          ],
        });
        // Should return Alice, Bob, Charlie, PLUS a record for the GUEST role
        // where the user fields are null/undefined.
        expect(result).toHaveLength(4);
        const guestRecord = result.find((r) => r.roleData?.name === "GUEST");
        expect(guestRecord).toBeDefined();
        if (!guestRecord) {
          throw new Error("Expected GUEST join record");
        }
        expect(guestRecord.id).toBeUndefined(); // Base user fields shouldn't exist
      });

      it("should perform a FULL JOIN", () => {
        const result = users.findMany({
          join: [
            {
              collection: roles,
              type: "full",
              on: { localField: "roleId", foreignField: "id" },
              as: "roleData",
            },
          ],
        });
        // Expect 5 records: Alice, Bob, Charlie, Dave (no role), and the GUEST record (no user)
        expect(result).toHaveLength(5);
      });
    });
  });

  describe("Pagination and Sorting (limit, offset, orderBy)", () => {
    it("should sort records using a single orderBy (asc and desc)", () => {
      const ascResult = users.findMany({
        orderBy: { age: "asc" },
      });
      expect(ascResult.map((u) => u.name)).toEqual(["Charlie", "Alice", "Bob", "Dave"]);

      const descResult = users.findMany({
        orderBy: { age: "desc" },
      });
      expect(descResult.map((u) => u.name)).toEqual(["Dave", "Bob", "Alice", "Charlie"]);
    });

    it("should sort records using multiple fields in orderBy", () => {
      // Insert a new user to create a tie in age (Bob and Aaron are both 30)
      users.insert({ id: "99", name: "Aaron", age: 30, roleId: "2", email: "aaron@test.com" });

      // Sort by age descending. If tied, sort by name ascending.
      // 40 (Dave), 30 (Aaron, then Bob), 25 (Alice), 18 (Charlie)
      const result = users.findMany({
        orderBy: [{ age: "desc" }, { name: "asc" }],
      });

      expect(result.map((u) => u.name)).toEqual(["Dave", "Aaron", "Bob", "Alice", "Charlie"]);

      // Cleanup so we don't mess up subsequent tests
      users.delete({ where: { id: { eq: "99" } } });
    });

    it("should limit the number of returned records", () => {
      const result = users.findMany({
        limit: 2,
      });
      expect(result).toHaveLength(2);
      expect(result.map((u) => u.name)).toEqual(["Alice", "Bob"]);
    });

    it("should offset the returned records", () => {
      const result = users.findMany({
        offset: 1,
      });
      expect(result).toHaveLength(3);
      expect(result.map((u) => u.name)).toEqual(["Bob", "Charlie", "Dave"]);
    });

    it("should combine orderBy, limit, and offset", () => {
      const result = users.findMany({
        orderBy: { age: "desc" }, // Dave, Bob, Alice, Charlie
        offset: 1, // Skip Dave -> Bob, Alice, Charlie
        limit: 2, // Take 2 -> Bob, Alice
      });
      expect(result).toHaveLength(2);
      expect(result.map((u) => u.name)).toEqual(["Bob", "Alice"]);
    });
  });

  describe("Mutations (insert, update, delete)", () => {
    describe("insert()", () => {
      it("should insert a single record", () => {
        const newUser = { id: "5", name: "Frank", age: 40, roleId: "1", email: "frank@test.com" };
        const result = users.insert(newUser);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(newUser);

        // Verify it exists in the internal data store
        expect(users.getData()).toHaveLength(5);
        expect(users.findMany({ where: { id: { eq: "5" } } })).toHaveLength(1);
      });

      it("should insert multiple records at once", () => {
        const newUsers = [
          { id: "5", name: "Frank", age: 40, roleId: "1", email: "frank@test.com" },
          { id: "6", name: "Eve", age: 22, roleId: "2", email: "eve@test.com" },
        ];
        const result = users.insert(newUsers);

        expect(result).toHaveLength(2);
        expect(users.getData()).toHaveLength(6);
      });
    });

    describe("update()", () => {
      it("should update a single record by exact match", () => {
        const result = users.update({
          where: { id: { eq: "1" } },
          data: { age: 26, name: "Alice Updated" },
        });

        expect(result).toHaveLength(1);
        expect(result[0].age).toBe(26);
        expect(result[0].name).toBe("Alice Updated");
        // Ensure unchanged fields remain intact
        expect(result[0].roleId).toBe("1");

        // Verify the internal store was actually mutated
        const verify = users.findMany({ where: { id: { eq: "1" } } });
        expect(verify[0].age).toBe(26);
      });

      it("should update multiple records using operators", () => {
        // Alice (25), Bob (30), and Dave (40) are > 20
        const result = users.update({
          where: { age: { gt: 20 } },
          data: { roleId: "999" },
        });

        expect(result).toHaveLength(3);
        expect(result.map((u) => u.name).sort()).toEqual(["Alice", "Bob", "Dave"]);
        expect(result.every((u) => u.roleId === "999")).toBe(true);

        // Verify Charlie was untouched
        const charlie = users.findMany({ where: { id: { eq: "3" } } })[0];
        expect(charlie.roleId).toBe("3");
      });

      it("should return an empty array if no records match the where clause", () => {
        const result = users.update({
          where: { id: { eq: "non-existent" } },
          data: { age: 100 },
        });

        expect(result).toHaveLength(0);
        expect(users.getData()).toHaveLength(4); // Store remains unchanged
      });
    });

    describe("delete()", () => {
      it("should delete a single record by exact match", () => {
        const result = users.delete({
          where: { id: { eq: "2" } }, // Delete Bob
        });

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Bob");

        // Verify removal from internal store
        expect(users.getData()).toHaveLength(3);
        expect(users.findMany({ where: { id: { eq: "2" } } })).toHaveLength(0);
      });

      it("should delete multiple records using logical operators", () => {
        const result = users.delete({
          where: {
            OR: [
              { age: { lt: 20 } }, // Charlie (18)
              { roleId: { eq: "1" } }, // Alice (1)
            ],
          },
        });

        expect(result).toHaveLength(2);
        expect(result.map((u) => u.name).sort()).toEqual(["Alice", "Charlie"]);

        // Bob and Dave should remain
        const remaining = users.getData();
        expect(remaining).toHaveLength(2);
        expect(remaining.map((r) => r.name).sort()).toEqual(["Bob", "Dave"]);
      });

      it("should return an empty array and do nothing if no records match", () => {
        const result = users.delete({
          where: { age: { gt: 100 } },
        });

        expect(result).toHaveLength(0);
        expect(users.getData()).toHaveLength(4); // Store remains unchanged
      });
    });
  });
});
