import z from 'zod'

export const userModel = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  createdAt: z.string(),
})

export const productModel = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  stock: z.number(),
})

export const chatMessageModel = z.object({
  id: z.string(),
  user: z.string(),
  message: z.string(),
  timestamp: z.string(),
})

export const dataStreamModel = z.object({
  index: z.number(),
  value: z.string(),
  timestamp: z.string(),
})

export const sseMessageModel = z.object({
  type: z.enum(['update', 'notification', 'alert']),
  data: z.string(),
  timestamp: z.string(),
})
