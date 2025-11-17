import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import {
  defineDelete,
  defineGet,
  definePost,
  definePut,
} from '../../endpoint/define-endpoint'
import { createApiClient } from '../api-client'

describe('Multiple endpoints under same parameter path', () => {
  it('should handle multiple HTTP methods on same path parameter', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        }),
      }),
      updateUser: definePut('/users/:id', {
        input: {
          json: z.object({ name: z.string(), email: z.string().email() }),
        },
        response: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          updatedAt: z.string(),
        }),
      }),
      deleteUser: defineDelete('/users/:id', { response: z.void() }),
    }

    const app = new Hono()
      .get('/users/:id', (c) => {
        const { id } = c.req.param()
        return c.json({
          id,
          name: 'John Doe',
          email: 'john@example.com',
        })
      })
      .put(
        '/users/:id',
        zValidator(
          'json',
          z.object({ name: z.string(), email: z.string().email() }),
        ),
        (c) => {
          const { id } = c.req.param()
          return c.json({
            id,
            name: 'Updated John',
            email: 'john.updated@example.com',
            updatedAt: '2023-01-01T12:00:00Z',
          })
        },
      )
      .delete('/users/:id', (c) => c.body(null, 204))

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    // Test that all three HTTP methods work on the same parameter path
    const getUserRes = await client.api.users.id('123').get()
    expect(getUserRes).toHaveProperty('data')
    if (getUserRes.data) {
      expect(getUserRes.data.id).toBe('123')
      expect(getUserRes.data.name).toBe('John Doe')
    }

    const updateUserRes = await client.api.users.id('123').put({
      json: { name: 'Updated John', email: 'john.updated@example.com' },
    })
    expect(updateUserRes).toHaveProperty('data')
    if (updateUserRes.data) {
      expect(updateUserRes.data.name).toBe('Updated John')
      expect(updateUserRes.data.updatedAt).toBe('2023-01-01T12:00:00Z')
    }

    const deleteUserRes = await client.api.users.id('123').delete()
    expect(deleteUserRes).toHaveProperty('data')
  })

  it('should handle multiple sub-resources under same parameter', async () => {
    const apiSchema = {
      getUserInfo: defineGet('/users/:id/info', {
        response: z.object({
          id: z.string(),
          profile: z.object({
            bio: z.string(),
            location: z.string(),
          }),
        }),
      }),
      updateUserInfo: definePut('/users/:id/info', {
        input: {
          json: z.object({
            bio: z.string().optional(),
            location: z.string().optional(),
          }),
        },
        response: z.object({
          id: z.string(),
          profile: z.object({
            bio: z.string(),
            location: z.string(),
          }),
          updatedAt: z.string(),
        }),
      }),
      getUserMetrics: defineGet('/users/:id/metrics', {
        response: z.object({
          userId: z.string(),
          loginCount: z.number(),
          lastLogin: z.string(),
        }),
      }),
    }

    const app = new Hono()
      .get('/users/:id/info', (c) => {
        const { id } = c.req.param()
        return c.json({
          id,
          profile: {
            bio: 'Software engineer',
            location: 'San Francisco',
          },
        })
      })
      .put(
        '/users/:id/info',
        zValidator(
          'json',
          z.object({
            bio: z.string().optional(),
            location: z.string().optional(),
          }),
        ),
        (c) => {
          const { id } = c.req.param()
          return c.json({
            id,
            profile: {
              bio: 'Updated bio',
              location: 'Updated location',
            },
            updatedAt: '2023-01-01T13:00:00Z',
          })
        },
      )
      .get('/users/:id/metrics', (c) => {
        const { id } = c.req.param()
        return c.json({
          userId: id,
          loginCount: 42,
          lastLogin: '2023-01-01T11:00:00Z',
        })
      })

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    }) // Type assertion to bypass TypeScript complexity

    // Test different sub-resources under same parameter
    const getUserInfoRes = await client.api.users.id('456').info.get()
    expect(getUserInfoRes).toHaveProperty('data')
    if (getUserInfoRes.data) {
      expect(getUserInfoRes.data.id).toBe('456')
      expect(getUserInfoRes.data.profile.bio).toBe('Software engineer')
    }

    const updateUserInfoRes = await client.api.users.id('456').info.put({
      json: { bio: 'Updated bio', location: 'Updated location' },
    })
    expect(updateUserInfoRes).toHaveProperty('data')
    if (updateUserInfoRes.data) {
      expect(updateUserInfoRes.data.profile.bio).toBe('Updated bio')
      expect(updateUserInfoRes.data.updatedAt).toBe('2023-01-01T13:00:00Z')
    }

    const getUserMetricsRes = await client.api.users.id('789').metrics.get()
    expect(getUserMetricsRes).toHaveProperty('data')
    if (getUserMetricsRes.data) {
      expect(getUserMetricsRes.data.userId).toBe('789')
      expect(getUserMetricsRes.data.loginCount).toBe(42)
    }
  })

  it('should handle deeply nested parameter structures', async () => {
    const apiSchema = {
      getUserProjectTask: defineGet(
        '/users/:userId/projects/:projectId/tasks/:taskId',
        {
          response: z.object({
            id: z.string(),
            title: z.string(),
            projectId: z.string(),
            userId: z.string(),
          }),
        },
      ),
      updateUserProjectTask: definePut(
        '/users/:userId/projects/:projectId/tasks/:taskId',
        {
          input: {
            json: z.object({
              title: z.string(),
              completed: z.boolean().optional(),
            }),
          },
          response: z.object({
            id: z.string(),
            title: z.string(),
            completed: z.boolean(),
            projectId: z.string(),
            userId: z.string(),
            updatedAt: z.string(),
          }),
        },
      ),
      getUserProjectTaskComments: defineGet(
        '/users/:userId/projects/:projectId/tasks/:taskId/comments',
        {
          response: z.array(
            z.object({
              id: z.string(),
              content: z.string(),
              taskId: z.string(),
            }),
          ),
        },
      ),
      createUserProjectTaskComment: definePost(
        '/users/:userId/projects/:projectId/tasks/:taskId/comments',
        {
          input: {
            json: z.object({
              content: z.string(),
            }),
          },
          response: z.object({
            id: z.string(),
            content: z.string(),
            taskId: z.string(),
            createdAt: z.string(),
          }),
        },
      ),
    }

    const app = new Hono()
      .get('/users/:userId/projects/:projectId/tasks/:taskId', (c) => {
        const { userId, projectId, taskId } = c.req.param()
        return c.json({
          id: taskId,
          title: 'Sample Task',
          projectId,
          userId,
        })
      })
      .put(
        '/users/:userId/projects/:projectId/tasks/:taskId',
        zValidator(
          'json',
          z.object({
            title: z.string(),
            completed: z.boolean().optional(),
          }),
        ),
        (c) => {
          const { userId, projectId, taskId } = c.req.param()
          return c.json({
            id: taskId,
            title: 'Updated Task',
            completed: true,
            projectId,
            userId,
            updatedAt: '2023-01-01T14:00:00Z',
          })
        },
      )
      .get('/users/:userId/projects/:projectId/tasks/:taskId/comments', (c) => {
        const { taskId } = c.req.param()
        return c.json([
          {
            id: 'comment-1',
            content: 'First comment',
            taskId,
          },
        ])
      })
      .post(
        '/users/:userId/projects/:projectId/tasks/:taskId/comments',
        zValidator('json', z.object({ content: z.string() })),
        (c) => {
          const { taskId } = c.req.param()
          return c.json({
            id: 'new-comment',
            content: 'New comment',
            taskId,
            createdAt: '2023-01-01T15:00:00Z',
          })
        },
      )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    }) // Type assertion to bypass TypeScript complexity

    // Test deeply nested parameter structures
    const getTaskRes = await client.api.users
      .userId('user1')
      .projects.projectId('proj1')
      .tasks.taskId('task1')
      .get()
    expect(getTaskRes).toHaveProperty('data')
    if (getTaskRes.data) {
      expect(getTaskRes.data.id).toBe('task1')
      expect(getTaskRes.data.userId).toBe('user1')
      expect(getTaskRes.data.projectId).toBe('proj1')
    }

    const updateTaskRes = await client.api.users
      .userId('user1')
      .projects.projectId('proj1')
      .tasks.taskId('task1')
      .put({
        json: { title: 'Updated Task', completed: true },
      })
    expect(updateTaskRes).toHaveProperty('data')
    if (updateTaskRes.data) {
      expect(updateTaskRes.data.title).toBe('Updated Task')
      expect(updateTaskRes.data.completed).toBe(true)
    }

    // Test additional resource under deeply nested parameters
    const getCommentsRes = await client.api.users
      .userId('user1')
      .projects.projectId('proj1')
      .tasks.taskId('task1')
      .comments.get()
    expect(getCommentsRes).toHaveProperty('data')
    if (getCommentsRes.data) {
      expect(Array.isArray(getCommentsRes.data)).toBe(true)
      expect(getCommentsRes.data[0].content).toBe('First comment')
    }

    const createCommentRes = await client.api.users
      .userId('user1')
      .projects.projectId('proj1')
      .tasks.taskId('task1')
      .comments.post({
        json: { content: 'New comment' },
      })
    expect(createCommentRes).toHaveProperty('data')
    if (createCommentRes.data) {
      expect(createCommentRes.data.content).toBe('New comment')
      expect(createCommentRes.data.createdAt).toBe('2023-01-01T15:00:00Z')
    }
  })

  it('should handle mixed static resources and parameters correctly', async () => {
    const apiSchema = {
      // Static resource endpoints
      getUsersList: defineGet('/users', {
        response: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
      createUser: definePost('/users', {
        input: {
          json: z.object({ name: z.string(), email: z.string() }),
        },
        response: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        }),
      }),

      // Parameter-based endpoints under same base
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
      getUserSettings: defineGet('/users/:id/settings', {
        response: z.object({ userId: z.string(), theme: z.string() }),
      }),

      // Static resource under parameter
      getUserProfile: defineGet('/users/:id/profile', {
        response: z.object({ userId: z.string(), bio: z.string() }),
      }),

      // Nested mixed structures
      getUserPreferences: defineGet('/users/:id/settings/preferences', {
        response: z.object({ userId: z.string(), notifications: z.boolean() }),
      }),
    }

    const app = new Hono()
      .get('/users', (c) => c.json([{ id: '1', name: 'User 1' }]))
      .post('/users', (c) =>
        c.json({ id: 'new', name: 'New User', email: 'new@example.com' }),
      )
      .get('/users/:id', (c) => c.json({ id: c.req.param('id'), name: 'John' }))
      .get('/users/:id/settings', (c) =>
        c.json({ userId: c.req.param('id'), theme: 'dark' }),
      )
      .get('/users/:id/profile', (c) =>
        c.json({ userId: c.req.param('id'), bio: 'Developer' }),
      )
      .get('/users/:id/settings/preferences', (c) =>
        c.json({ userId: c.req.param('id'), notifications: true }),
      )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    }) // Type assertion to bypass TypeScript complexity

    // Test static resource endpoints work alongside parametric ones
    const getUsersListRes = await client.api.users.get()
    expect(getUsersListRes.data).toEqual([{ id: '1', name: 'User 1' }])

    const createUserRes = await client.api.users.post({
      json: { name: 'New User', email: 'new@example.com' },
    })
    expect(createUserRes.data?.name).toBe('New User')

    // Test parameter-based endpoints
    const getUserRes = await client.api.users.id('123').get()
    expect(getUserRes.data?.id).toBe('123')

    // Test nested resources under parameters
    const getUserSettingsRes = await client.api.users.id('123').settings.get()
    expect(getUserSettingsRes.data?.userId).toBe('123')
    expect(getUserSettingsRes.data?.theme).toBe('dark')

    const getUserProfileRes = await client.api.users.id('123').profile.get()
    expect(getUserProfileRes.data?.userId).toBe('123')
    expect(getUserProfileRes.data?.bio).toBe('Developer')

    // Test deeply nested mixed structures
    const getUserPreferencesRes = await client.api.users
      .id('123')
      .settings.preferences.get()
    expect(getUserPreferencesRes.data?.userId).toBe('123')
    expect(getUserPreferencesRes.data?.notifications).toBe(true)
  })

  it('should handle parameter collision edge cases', async () => {
    const apiSchema = {
      // Both endpoints have parameters, but different ones
      getUserPost: defineGet('/users/:userId/posts/:postId', {
        response: z.object({
          userId: z.string(),
          postId: z.string(),
          title: z.string(),
        }),
      }),
      getUserComment: defineGet('/users/:userId/comments/:commentId', {
        response: z.object({
          userId: z.string(),
          commentId: z.string(),
          content: z.string(),
        }),
      }),

      // Same parameter names but different contexts
      getProjectTask: defineGet('/projects/:id/tasks/:taskId', {
        response: z.object({
          projectId: z.string(),
          taskId: z.string(),
          title: z.string(),
        }),
      }),
      getUserTask: defineGet('/users/:id/tasks/:taskId', {
        response: z.object({
          userId: z.string(),
          taskId: z.string(),
          title: z.string(),
        }),
      }),
    }

    const app = new Hono()
      .get('/users/:userId/posts/:postId', (c) => {
        const { userId, postId } = c.req.param()
        return c.json({ userId, postId, title: 'Post Title' })
      })
      .get('/users/:userId/comments/:commentId', (c) => {
        const { userId, commentId } = c.req.param()
        return c.json({ userId, commentId, content: 'Comment Content' })
      })
      .get('/projects/:id/tasks/:taskId', (c) => {
        const { id, taskId } = c.req.param()
        return c.json({ projectId: id, taskId, title: 'Project Task' })
      })
      .get('/users/:id/tasks/:taskId', (c) => {
        const { id, taskId } = c.req.param()
        return c.json({ userId: id, taskId, title: 'User Task' })
      })

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    }) // Type assertion to bypass TypeScript complexity

    // Test different parameter names under same base
    const getUserPostRes = await client.api.users
      .userId('user1')
      .posts.postId('post1')
      .get()
    expect(getUserPostRes.data?.userId).toBe('user1')
    expect(getUserPostRes.data?.postId).toBe('post1')
    expect(getUserPostRes.data?.title).toBe('Post Title')

    const getUserCommentRes = await client.api.users
      .userId('user1')
      .comments.commentId('comment1')
      .get()
    expect(getUserCommentRes.data?.userId).toBe('user1')
    expect(getUserCommentRes.data?.commentId).toBe('comment1')
    expect(getUserCommentRes.data?.content).toBe('Comment Content')

    // Test same parameter names in different contexts
    const getProjectTaskRes = await client.api.projects
      .id('proj1')
      .tasks.taskId('task1')
      .get()
    expect(getProjectTaskRes.data?.projectId).toBe('proj1')
    expect(getProjectTaskRes.data?.taskId).toBe('task1')
    expect(getProjectTaskRes.data?.title).toBe('Project Task')

    const getUserTaskRes = await client.api.users
      .id('user1')
      .tasks.taskId('task1')
      .get()
    expect(getUserTaskRes.data?.userId).toBe('user1')
    expect(getUserTaskRes.data?.taskId).toBe('task1')
    expect(getUserTaskRes.data?.title).toBe('User Task')
  })

  it('should handle root-level functions with multiple parameter paths', async () => {
    const apiSchema = {
      // Root-level endpoints
      getHealth: defineGet('/health', {
        response: z.object({ status: z.string(), timestamp: z.string() }),
      }),
      getVersion: defineGet('/version', {
        response: z.object({ version: z.string(), build: z.string() }),
      }),
      getRootStats: defineGet('/stats', {
        response: z.object({ requests: z.number(), uptime: z.number() }),
      }),

      // Multiple different paths after a single parameter
      getUserProfile: defineGet('/users/:id/profile', {
        response: z.object({
          userId: z.string(),
          name: z.string(),
          bio: z.string(),
        }),
      }),
      getUserSettings: defineGet('/users/:id/settings', {
        response: z.object({
          userId: z.string(),
          theme: z.string(),
          language: z.string(),
        }),
      }),
      getUserPosts: defineGet('/users/:id/posts', {
        response: z.array(
          z.object({ id: z.string(), title: z.string(), userId: z.string() }),
        ),
      }),
      getUserNotifications: defineGet('/users/:id/notifications', {
        response: z.array(
          z.object({ id: z.string(), message: z.string(), read: z.boolean() }),
        ),
      }),
      getUserFriends: defineGet('/users/:id/friends', {
        response: z.array(
          z.object({ id: z.string(), name: z.string(), status: z.string() }),
        ),
      }),

      // Mix of HTTP methods on same parameter with different sub-paths
      createUserPost: definePost('/users/:id/posts', {
        input: { json: z.object({ title: z.string(), content: z.string() }) },
        response: z.object({
          id: z.string(),
          title: z.string(),
          userId: z.string(),
          createdAt: z.string(),
        }),
      }),
      updateUserSettings: definePut('/users/:id/settings', {
        input: {
          json: z.object({
            theme: z.string().optional(),
            language: z.string().optional(),
          }),
        },
        response: z.object({
          userId: z.string(),
          theme: z.string(),
          language: z.string(),
          updatedAt: z.string(),
        }),
      }),
      deleteUserNotification: defineDelete(
        '/users/:id/notifications/:notificationId',
        {
          response: z.void(),
        },
      ),
    }

    const app = new Hono()
      .get('/health', (c) =>
        c.json({ status: 'ok', timestamp: '2023-01-01T12:00:00Z' }),
      )
      .get('/version', (c) => c.json({ version: '1.0.0', build: '12345' }))
      .get('/stats', (c) => c.json({ requests: 1000, uptime: 3600 }))
      .get('/users/:id/profile', (c) => {
        const id = c.req.param('id')
        return c.json({
          userId: id,
          name: 'John Doe',
          bio: 'Software developer',
        })
      })
      .get('/users/:id/settings', (c) => {
        const id = c.req.param('id')
        return c.json({ userId: id, theme: 'dark', language: 'en' })
      })
      .get('/users/:id/posts', (c) => {
        const id = c.req.param('id')
        return c.json([{ id: 'post1', title: 'My Post', userId: id }])
      })
      .get('/users/:id/notifications', (c) => {
        return c.json([{ id: 'notif1', message: 'Welcome!', read: false }])
      })
      .get('/users/:id/friends', (c) => {
        return c.json([{ id: 'friend1', name: 'Jane', status: 'online' }])
      })
      .post(
        '/users/:id/posts',
        zValidator(
          'json',
          z.object({ title: z.string(), content: z.string() }),
        ),
        (c) => {
          const id = c.req.param('id')
          return c.json({
            id: 'newpost',
            title: 'New Post',
            userId: id,
            createdAt: '2023-01-01T13:00:00Z',
          })
        },
      )
      .put(
        '/users/:id/settings',
        zValidator(
          'json',
          z.object({
            theme: z.string().optional(),
            language: z.string().optional(),
          }),
        ),
        (c) => {
          const id = c.req.param('id')
          return c.json({
            userId: id,
            theme: 'light',
            language: 'es',
            updatedAt: '2023-01-01T14:00:00Z',
          })
        },
      )
      .delete('/users/:id/notifications/:notificationId', (c) =>
        c.body(null, 204),
      )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    // Test root-level endpoints
    const healthRes = await client.api.health.get()
    expect(healthRes.data?.status).toBe('ok')
    expect(healthRes.data?.timestamp).toBe('2023-01-01T12:00:00Z')

    const versionRes = await client.api.version.get()
    expect(versionRes.data?.version).toBe('1.0.0')
    expect(versionRes.data?.build).toBe('12345')

    const statsRes = await client.api.stats.get()
    expect(statsRes.data?.requests).toBe(1000)
    expect(statsRes.data?.uptime).toBe(3600)

    // Test multiple different paths after single parameter
    const userId = 'user123'

    const profileRes = await client.api.users.id(userId).profile.get()
    expect(profileRes.data?.userId).toBe(userId)
    expect(profileRes.data?.name).toBe('John Doe')
    expect(profileRes.data?.bio).toBe('Software developer')

    const settingsRes = await client.api.users.id(userId).settings.get()
    expect(settingsRes.data?.userId).toBe(userId)
    expect(settingsRes.data?.theme).toBe('dark')
    expect(settingsRes.data?.language).toBe('en')

    const postsRes = await client.api.users.id(userId).posts.get()
    expect(Array.isArray(postsRes.data)).toBe(true)
    expect(postsRes.data?.[0]?.userId).toBe(userId)

    const notificationsRes = await client.api.users
      .id(userId)
      .notifications.get()
    expect(Array.isArray(notificationsRes.data)).toBe(true)
    expect(notificationsRes.data?.[0]?.message).toBe('Welcome!')

    const friendsRes = await client.api.users.id(userId).friends.get()
    expect(Array.isArray(friendsRes.data)).toBe(true)
    expect(friendsRes.data?.[0]?.status).toBe('online')

    // Test mixed HTTP methods on parameter paths
    const createPostRes = await client.api.users.id(userId).posts.post({
      json: { title: 'New Post', content: 'Post content' },
    })
    expect(createPostRes.data?.title).toBe('New Post')
    expect(createPostRes.data?.userId).toBe(userId)

    const updateSettingsRes = await client.api.users.id(userId).settings.put({
      json: { theme: 'light', language: 'es' },
    })
    expect(updateSettingsRes.data?.theme).toBe('light')
    expect(updateSettingsRes.data?.language).toBe('es')

    const deleteNotificationRes = await client.api.users
      .id(userId)
      .notifications.notificationId('notif1')
      .delete()
    expect(deleteNotificationRes).toHaveProperty('data')
  })

  it('should handle multiple parameters in sequence with various sub-paths', async () => {
    const apiSchema = {
      // Multiple parameters with different sub-paths
      getOrganizationProject: defineGet('/orgs/:orgId/projects/:projectId', {
        response: z.object({
          orgId: z.string(),
          projectId: z.string(),
          name: z.string(),
        }),
      }),
      getOrganizationProjectMembers: defineGet(
        '/orgs/:orgId/projects/:projectId/members',
        {
          response: z.array(
            z.object({ id: z.string(), name: z.string(), role: z.string() }),
          ),
        },
      ),
      getOrganizationProjectSettings: defineGet(
        '/orgs/:orgId/projects/:projectId/settings',
        {
          response: z.object({
            projectId: z.string(),
            visibility: z.string(),
            features: z.array(z.string()),
          }),
        },
      ),
      getOrganizationProjectIssues: defineGet(
        '/orgs/:orgId/projects/:projectId/issues',
        {
          response: z.array(
            z.object({ id: z.string(), title: z.string(), status: z.string() }),
          ),
        },
      ),
      getOrganizationProjectAnalytics: defineGet(
        '/orgs/:orgId/projects/:projectId/analytics',
        {
          response: z.object({
            projectId: z.string(),
            commits: z.number(),
            contributors: z.number(),
          }),
        },
      ),

      // Three-level parameters with different endpoints
      getOrganizationProjectIssueComments: defineGet(
        '/orgs/:orgId/projects/:projectId/issues/:issueId/comments',
        {
          response: z.array(
            z.object({
              id: z.string(),
              content: z.string(),
              author: z.string(),
            }),
          ),
        },
      ),
      createOrganizationProjectIssueComment: definePost(
        '/orgs/:orgId/projects/:projectId/issues/:issueId/comments',
        {
          input: { json: z.object({ content: z.string() }) },
          response: z.object({
            id: z.string(),
            content: z.string(),
            author: z.string(),
            createdAt: z.string(),
          }),
        },
      ),
      updateOrganizationProjectIssue: definePut(
        '/orgs/:orgId/projects/:projectId/issues/:issueId',
        {
          input: {
            json: z.object({
              title: z.string().optional(),
              status: z.string().optional(),
            }),
          },
          response: z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            updatedAt: z.string(),
          }),
        },
      ),

      // Four-level parameters
      getOrganizationProjectIssueCommentReplies: defineGet(
        '/orgs/:orgId/projects/:projectId/issues/:issueId/comments/:commentId/replies',
        {
          response: z.array(
            z.object({
              id: z.string(),
              content: z.string(),
              parentId: z.string(),
            }),
          ),
        },
      ),
    }

    const app = new Hono()
      .get('/orgs/:orgId/projects/:projectId', (c) => {
        const { orgId, projectId } = c.req.param()
        return c.json({ orgId, projectId, name: 'Sample Project' })
      })
      .get('/orgs/:orgId/projects/:projectId/members', (c) => {
        return c.json([{ id: 'member1', name: 'Alice', role: 'admin' }])
      })
      .get('/orgs/:orgId/projects/:projectId/settings', (c) => {
        const { projectId } = c.req.param()
        return c.json({
          projectId,
          visibility: 'public',
          features: ['issues', 'wiki'],
        })
      })
      .get('/orgs/:orgId/projects/:projectId/issues', (c) => {
        return c.json([{ id: 'issue1', title: 'Bug report', status: 'open' }])
      })
      .get('/orgs/:orgId/projects/:projectId/analytics', (c) => {
        const { projectId } = c.req.param()
        return c.json({ projectId, commits: 150, contributors: 5 })
      })
      .get('/orgs/:orgId/projects/:projectId/issues/:issueId/comments', (c) => {
        return c.json([
          { id: 'comment1', content: 'Great issue!', author: 'bob' },
        ])
      })
      .post(
        '/orgs/:orgId/projects/:projectId/issues/:issueId/comments',
        zValidator('json', z.object({ content: z.string() })),
        (c) => {
          return c.json({
            id: 'newcomment',
            content: 'New comment',
            author: 'alice',
            createdAt: '2023-01-01T15:00:00Z',
          })
        },
      )
      .put(
        '/orgs/:orgId/projects/:projectId/issues/:issueId',
        zValidator(
          'json',
          z.object({
            title: z.string().optional(),
            status: z.string().optional(),
          }),
        ),
        (c) => {
          const { issueId } = c.req.param()
          return c.json({
            id: issueId,
            title: 'Updated Issue',
            status: 'closed',
            updatedAt: '2023-01-01T16:00:00Z',
          })
        },
      )
      .get(
        '/orgs/:orgId/projects/:projectId/issues/:issueId/comments/:commentId/replies',
        (c) => {
          const { commentId } = c.req.param()
          return c.json([
            { id: 'reply1', content: 'Reply to comment', parentId: commentId },
          ])
        },
      )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    const orgId = 'org123'
    const projectId = 'proj456'
    const issueId = 'issue789'
    const commentId = 'comment101'

    // Test two-level parameters with different sub-paths
    const projectRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .get()
    expect(projectRes.data?.orgId).toBe(orgId)
    expect(projectRes.data?.projectId).toBe(projectId)
    expect(projectRes.data?.name).toBe('Sample Project')

    const membersRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .members.get()
    expect(Array.isArray(membersRes.data)).toBe(true)
    expect(membersRes.data?.[0]?.role).toBe('admin')

    const settingsRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .settings.get()
    expect(settingsRes.data?.projectId).toBe(projectId)
    expect(settingsRes.data?.visibility).toBe('public')

    const issuesRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .issues.get()
    expect(Array.isArray(issuesRes.data)).toBe(true)
    expect(issuesRes.data?.[0]?.status).toBe('open')

    const analyticsRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .analytics.get()
    expect(analyticsRes.data?.commits).toBe(150)
    expect(analyticsRes.data?.contributors).toBe(5)

    // Test three-level parameters
    const commentsRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .issues.issueId(issueId)
      .comments.get()
    expect(Array.isArray(commentsRes.data)).toBe(true)
    expect(commentsRes.data?.[0]?.content).toBe('Great issue!')

    const createCommentRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .issues.issueId(issueId)
      .comments.post({
        json: { content: 'New comment' },
      })
    expect(createCommentRes.data?.content).toBe('New comment')
    expect(createCommentRes.data?.author).toBe('alice')

    const updateIssueRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .issues.issueId(issueId)
      .put({
        json: { title: 'Updated Issue', status: 'closed' },
      })
    expect(updateIssueRes.data?.title).toBe('Updated Issue')
    expect(updateIssueRes.data?.status).toBe('closed')

    // Test four-level parameters
    const repliesRes = await client.api.orgs
      .orgId(orgId)
      .projects.projectId(projectId)
      .issues.issueId(issueId)
      .comments.commentId(commentId)
      .replies.get()
    expect(Array.isArray(repliesRes.data)).toBe(true)
    expect(repliesRes.data?.[0]?.parentId).toBe(commentId)
  })

  it('should handle complex mixed scenarios with root functions and multi-parameter paths', async () => {
    const apiSchema = {
      // Root-level admin functions
      getSystemStatus: defineGet('/admin/system', {
        response: z.object({
          status: z.string(),
          load: z.number(),
          memory: z.number(),
        }),
      }),
      getSystemLogs: defineGet('/admin/logs', {
        response: z.array(
          z.object({
            timestamp: z.string(),
            level: z.string(),
            message: z.string(),
          }),
        ),
      }),

      // Root-level API functions
      getApiInfo: defineGet('/api/info', {
        response: z.object({
          name: z.string(),
          version: z.string(),
          endpoints: z.number(),
        }),
      }),

      // Single parameter with multiple sub-resources
      getCompanyInfo: defineGet('/companies/:companyId/info', {
        response: z.object({
          id: z.string(),
          name: z.string(),
          industry: z.string(),
        }),
      }),
      getCompanyEmployees: defineGet('/companies/:companyId/employees', {
        response: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            department: z.string(),
          }),
        ),
      }),
      getCompanyDepartments: defineGet('/companies/:companyId/departments', {
        response: z.array(
          z.object({ id: z.string(), name: z.string(), manager: z.string() }),
        ),
      }),

      // Multiple parameters with branching paths
      getCompanyEmployeeProfile: defineGet(
        '/companies/:companyId/employees/:employeeId/profile',
        {
          response: z.object({
            companyId: z.string(),
            employeeId: z.string(),
            name: z.string(),
            position: z.string(),
          }),
        },
      ),
      getCompanyEmployeeProjects: defineGet(
        '/companies/:companyId/employees/:employeeId/projects',
        {
          response: z.array(
            z.object({ id: z.string(), name: z.string(), status: z.string() }),
          ),
        },
      ),
      getCompanyDepartmentTeams: defineGet(
        '/companies/:companyId/departments/:departmentId/teams',
        {
          response: z.array(
            z.object({ id: z.string(), name: z.string(), lead: z.string() }),
          ),
        },
      ),

      // Three-parameter paths with different endpoints
      getCompanyEmployeeProjectTasks: defineGet(
        '/companies/:companyId/employees/:employeeId/projects/:projectId/tasks',
        {
          response: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              status: z.string(),
              assignee: z.string(),
            }),
          ),
        },
      ),
      createCompanyEmployeeProjectTask: definePost(
        '/companies/:companyId/employees/:employeeId/projects/:projectId/tasks',
        {
          input: {
            json: z.object({ title: z.string(), description: z.string() }),
          },
          response: z.object({
            id: z.string(),
            title: z.string(),
            assignee: z.string(),
            createdAt: z.string(),
          }),
        },
      ),

      // Mix of different parameter patterns
      getRegionCountryCity: defineGet(
        '/regions/:regionId/countries/:countryId/cities/:cityId',
        {
          response: z.object({
            regionId: z.string(),
            countryId: z.string(),
            cityId: z.string(),
            name: z.string(),
            population: z.number(),
          }),
        },
      ),
      getRegionStats: defineGet('/regions/:regionId/stats', {
        response: z.object({
          regionId: z.string(),
          countries: z.number(),
          totalPopulation: z.number(),
        }),
      }),
    }

    const app = new Hono()
      .get('/admin/system', (c) =>
        c.json({ status: 'healthy', load: 0.75, memory: 0.6 }),
      )
      .get('/admin/logs', (c) =>
        c.json([
          {
            timestamp: '2023-01-01T12:00:00Z',
            level: 'INFO',
            message: 'System started',
          },
        ]),
      )
      .get('/api/info', (c) =>
        c.json({ name: 'MockDash API', version: '2.0.0', endpoints: 25 }),
      )
      .get('/companies/:companyId/info', (c) => {
        const { companyId } = c.req.param()
        return c.json({
          id: companyId,
          name: 'Tech Corp',
          industry: 'Technology',
        })
      })
      .get('/companies/:companyId/employees', (c) => {
        return c.json([
          { id: 'emp1', name: 'Alice Smith', department: 'Engineering' },
        ])
      })
      .get('/companies/:companyId/departments', (c) => {
        return c.json([
          { id: 'dept1', name: 'Engineering', manager: 'Bob Johnson' },
        ])
      })
      .get('/companies/:companyId/employees/:employeeId/profile', (c) => {
        const { companyId, employeeId } = c.req.param()
        return c.json({
          companyId,
          employeeId,
          name: 'Alice Smith',
          position: 'Senior Engineer',
        })
      })
      .get('/companies/:companyId/employees/:employeeId/projects', (c) => {
        return c.json([{ id: 'proj1', name: 'Mobile App', status: 'active' }])
      })
      .get('/companies/:companyId/departments/:departmentId/teams', (c) => {
        return c.json([
          { id: 'team1', name: 'Frontend Team', lead: 'Charlie Brown' },
        ])
      })
      .get(
        '/companies/:companyId/employees/:employeeId/projects/:projectId/tasks',
        (c) => {
          return c.json([
            {
              id: 'task1',
              title: 'Implement login',
              status: 'in-progress',
              assignee: 'alice',
            },
          ])
        },
      )
      .post(
        '/companies/:companyId/employees/:employeeId/projects/:projectId/tasks',
        zValidator(
          'json',
          z.object({ title: z.string(), description: z.string() }),
        ),
        (c) => {
          return c.json({
            id: 'newtask',
            title: 'New Task',
            assignee: 'alice',
            createdAt: '2023-01-01T17:00:00Z',
          })
        },
      )
      .get('/regions/:regionId/countries/:countryId/cities/:cityId', (c) => {
        const { regionId, countryId, cityId } = c.req.param()
        return c.json({
          regionId,
          countryId,
          cityId,
          name: 'San Francisco',
          population: 875000,
        })
      })
      .get('/regions/:regionId/stats', (c) => {
        const { regionId } = c.req.param()
        return c.json({ regionId, countries: 5, totalPopulation: 50000000 })
      })

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    // Test root-level admin and API endpoints
    const systemRes = await client.api.admin.system.get()
    expect(systemRes.data?.status).toBe('healthy')
    expect(systemRes.data?.load).toBe(0.75)

    const logsRes = await client.api.admin.logs.get()
    expect(Array.isArray(logsRes.data)).toBe(true)
    expect(logsRes.data?.[0]?.level).toBe('INFO')

    const apiInfoRes = await client.api.api.info.get()
    expect(apiInfoRes.data?.name).toBe('MockDash API')
    expect(apiInfoRes.data?.endpoints).toBe(25)

    // Test single parameter with multiple sub-resources
    const companyId = 'comp123'
    const employeeId = 'emp456'
    const projectId = 'proj789'
    const departmentId = 'dept101'

    const companyInfoRes = await client.api.companies
      .companyId(companyId)
      .info.get()
    expect(companyInfoRes.data?.id).toBe(companyId)
    expect(companyInfoRes.data?.name).toBe('Tech Corp')

    const employeesRes = await client.api.companies
      .companyId(companyId)
      .employees.get()
    expect(Array.isArray(employeesRes.data)).toBe(true)
    expect(employeesRes.data?.[0]?.department).toBe('Engineering')

    const departmentsRes = await client.api.companies
      .companyId(companyId)
      .departments.get()
    expect(Array.isArray(departmentsRes.data)).toBe(true)

    // Test multiple parameters with branching paths
    const employeeProfileRes = await client.api.companies
      .companyId(companyId)
      .employees.employeeId(employeeId)
      .profile.get()
    expect(employeeProfileRes.data?.companyId).toBe(companyId)
    expect(employeeProfileRes.data?.employeeId).toBe(employeeId)

    const employeeProjectsRes = await client.api.companies
      .companyId(companyId)
      .employees.employeeId(employeeId)
      .projects.get()
    expect(Array.isArray(employeeProjectsRes.data)).toBe(true)

    const departmentTeamsRes = await client.api.companies
      .companyId(companyId)
      .departments.departmentId(departmentId)
      .teams.get()
    expect(Array.isArray(departmentTeamsRes.data)).toBe(true)

    // Test three-parameter paths
    const tasksRes = await client.api.companies
      .companyId(companyId)
      .employees.employeeId(employeeId)
      .projects.projectId(projectId)
      .tasks.get()
    expect(Array.isArray(tasksRes.data)).toBe(true)
    expect(tasksRes.data?.[0]?.status).toBe('in-progress')

    const createTaskRes = await client.api.companies
      .companyId(companyId)
      .employees.employeeId(employeeId)
      .projects.projectId(projectId)
      .tasks.post({
        json: { title: 'New Task', description: 'Task description' },
      })
    expect(createTaskRes.data?.title).toBe('New Task')

    // Test different parameter patterns
    const cityRes = await client.api.regions
      .regionId('reg1')
      .countries.countryId('us')
      .cities.cityId('sf')
      .get()
    expect(cityRes.data?.name).toBe('San Francisco')
    expect(cityRes.data?.population).toBe(875000)

    const regionStatsRes = await client.api.regions.regionId('reg1').stats.get()
    expect(regionStatsRes.data?.countries).toBe(5)
    expect(regionStatsRes.data?.totalPopulation).toBe(50000000)
  })

  it('should handle root path endpoint "/" alongside other endpoints', async () => {
    const apiSchema = {
      // Root endpoint at "/"
      getRootEndpoint: defineGet('/', {
        response: z.object({ message: z.string(), service: z.string() }),
      }),

      // Other root-level endpoints
      getHealth: defineGet('/health', {
        response: z.object({ status: z.string() }),
      }),
      getVersion: defineGet('/version', {
        response: z.object({ version: z.string() }),
      }),

      // Parameter-based endpoints
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
      getUserProfile: defineGet('/users/:id/profile', {
        response: z.object({ userId: z.string(), bio: z.string() }),
      }),

      // Multiple parameters
      getUserPost: defineGet('/users/:userId/posts/:postId', {
        response: z.object({
          userId: z.string(),
          postId: z.string(),
          title: z.string(),
        }),
      }),
    }

    const app = new Hono()
      .get('/', (c) =>
        c.json({ message: 'Welcome to the API', service: 'mock-dash' }),
      )
      .get('/health', (c) => c.json({ status: 'ok' }))
      .get('/version', (c) => c.json({ version: '1.0.0' }))
      .get('/users/:id', (c) => {
        const id = c.req.param('id')
        return c.json({ id, name: 'John Doe' })
      })
      .get('/users/:id/profile', (c) => {
        const id = c.req.param('id')
        return c.json({ userId: id, bio: 'Software developer' })
      })
      .get('/users/:userId/posts/:postId', (c) => {
        const { userId, postId } = c.req.param()
        return c.json({ userId, postId, title: 'Sample Post' })
      })

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    // Test root endpoint "/"
    const rootRes = await client.api.get()
    expect(rootRes.data?.message).toBe('Welcome to the API')
    expect(rootRes.data?.service).toBe('mock-dash')

    // Test other root-level endpoints
    const healthRes = await client.api.health.get()
    expect(healthRes.data?.status).toBe('ok')

    const versionRes = await client.api.version.get()
    expect(versionRes.data?.version).toBe('1.0.0')

    // Test parameter endpoints work alongside root endpoint
    const userRes = await client.api.users.id('123').get()
    expect(userRes.data?.id).toBe('123')
    expect(userRes.data?.name).toBe('John Doe')

    const userProfileRes = await client.api.users.id('123').profile.get()
    expect(userProfileRes.data?.userId).toBe('123')
    expect(userProfileRes.data?.bio).toBe('Software developer')

    const userPostRes = await client.api.users
      .userId('456')
      .posts.postId('post1')
      .get()
    expect(userPostRes.data?.userId).toBe('456')
    expect(userPostRes.data?.postId).toBe('post1')
    expect(userPostRes.data?.title).toBe('Sample Post')
  })

  it('should handle multiple root path variations', async () => {
    const apiSchema = {
      // Different HTTP methods on root path
      getRootInfo: defineGet('/', {
        response: z.object({ info: z.string() }),
      }),
      createRootResource: definePost('/', {
        input: { json: z.object({ data: z.string() }) },
        response: z.object({
          id: z.string(),
          data: z.string(),
          created: z.string(),
        }),
      }),

      // Mix of root and nested endpoints
      getStats: defineGet('/stats', {
        response: z.object({ requests: z.number() }),
      }),
      getApiDocs: defineGet('/docs', {
        response: z.object({ docs: z.string(), version: z.string() }),
      }),

      // Ensure root doesn't interfere with parameter paths
      getResource: defineGet('/resources/:id', {
        response: z.object({ id: z.string(), type: z.string() }),
      }),
      getResourceDetails: defineGet('/resources/:id/details', {
        response: z.object({
          resourceId: z.string(),
          details: z.object({ size: z.number() }),
        }),
      }),
    }

    const app = new Hono()
      .get('/', (c) => c.json({ info: 'API Root' }))
      .post('/', zValidator('json', z.object({ data: z.string() })), (c) => {
        return c.json({
          id: 'new-resource',
          data: 'created',
          created: '2023-01-01T12:00:00Z',
        })
      })
      .get('/stats', (c) => c.json({ requests: 1000 }))
      .get('/docs', (c) =>
        c.json({ docs: 'API Documentation', version: '1.0.0' }),
      )
      .get('/resources/:id', (c) => {
        const id = c.req.param('id')
        return c.json({ id, type: 'resource' })
      })
      .get('/resources/:id/details', (c) => {
        const id = c.req.param('id')
        return c.json({ resourceId: id, details: { size: 1024 } })
      })

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    // Test different HTTP methods on root path
    const rootGetRes = await client.api.get()
    expect(rootGetRes.data?.info).toBe('API Root')

    const rootPostRes = await client.api.post({
      json: { data: 'test data' },
    })
    expect(rootPostRes.data?.id).toBe('new-resource')
    expect(rootPostRes.data?.created).toBe('2023-01-01T12:00:00Z')

    // Test other root-level endpoints
    const statsRes = await client.api.stats.get()
    expect(statsRes.data?.requests).toBe(1000)

    const docsRes = await client.api.docs.get()
    expect(docsRes.data?.docs).toBe('API Documentation')

    // Test that parameter paths work correctly alongside root
    const resourceRes = await client.api.resources.id('res123').get()
    expect(resourceRes.data?.id).toBe('res123')
    expect(resourceRes.data?.type).toBe('resource')

    const resourceDetailsRes = await client.api.resources
      .id('res123')
      .details.get()
    expect(resourceDetailsRes.data?.resourceId).toBe('res123')
    expect(resourceDetailsRes.data?.details.size).toBe(1024)
  })
})
