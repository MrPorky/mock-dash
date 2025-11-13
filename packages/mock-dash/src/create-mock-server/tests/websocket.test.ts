import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet } from '../../endpoint/define-endpoint'
import { defineWebSocket } from '../../endpoint/ws-response'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - WebSocket endpoints', () => {
  it('should throw error when upgradeWebSocket not provided', () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket(
          [z.object({ message: z.string() })],
          [z.object({ text: z.string() })],
        ),
      }),
    }

    expect(() => createMockServer(apiSchema)).toThrow(
      'options.upgradeWebSocket is not defined',
    )
  })

  it('should register WebSocket endpoint with upgradeWebSocket', () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket(
          [z.object({ message: z.string() })],
          [z.object({ text: z.string() })],
        ),
      }),
    }

    // Mock upgradeWebSocket implementation
    const mockUpgradeWebSocket: any = () => () => {}

    // Should not throw when upgradeWebSocket is provided
    expect(() =>
      createMockServer(apiSchema, {
        upgradeWebSocket: mockUpgradeWebSocket,
      }),
    ).not.toThrow()
  })

  it('should allow defining mock for WebSocket endpoint', () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket(
          [z.object({ message: z.string() })],
          [z.object({ text: z.string() })],
        ),
      }),
    }

    // Should allow defining a mock
    expect(() => {
      apiSchema.chat.defineMock(() => ({
        onOpen: () => {},
        onMessage: () => {},
      }))
    }).not.toThrow()

    const mock = apiSchema.chat.getMock()
    expect(mock).toBeDefined()
  })

  it('should support function-based WebSocket mock with context', () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        input: {
          query: { userId: z.string() },
        },
        response: defineWebSocket(
          [z.object({ message: z.string() })],
          [z.object({ text: z.string() })],
        ),
      }),
    }

    apiSchema.chat.defineMock((ctx) => {
      // Access context in mock
      const userId = ctx.inputs.query.userId

      return {
        onOpen: () => {
          // Use userId in handler
          expect(userId).toBeDefined()
        },
      }
    })

    const mock = apiSchema.chat.getMock()
    expect(mock).toBeDefined()
    expect(typeof mock).toBe('function')
  })

  it('should register WebSocket endpoint with path parameters', () => {
    const apiSchema = {
      roomChat: defineGet('/rooms/:roomId/chat', {
        response: defineWebSocket(
          [z.object({ message: z.string() })],
          [z.object({ text: z.string() })],
        ),
      }),
    }

    apiSchema.roomChat.defineMock((ctx) => ({
      onOpen: () => {
        // Access room ID from path params
        const roomId = (ctx.inputs.param as { roomId: string }).roomId
        expect(roomId).toBeDefined()
      },
    }))

    const mockUpgradeWebSocket: any = () => () => {}

    const { app } = createMockServer(apiSchema, {
      upgradeWebSocket: mockUpgradeWebSocket,
    })

    expect(app).toBeDefined()
  })

  it('should validate WebSocket response schema types', () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket(
          [
            z.object({ type: z.literal('message'), text: z.string() }),
            z.object({ type: z.literal('notification'), count: z.number() }),
          ],
          [z.object({ userMessage: z.string() })],
        ),
      }),
    }

    apiSchema.chat.defineMock(() => ({
      onMessage: () => {
        // WebSocket send will be validated at runtime
      },
    }))

    const mock = apiSchema.chat.getMock()
    expect(mock).toBeDefined()
  })
})
