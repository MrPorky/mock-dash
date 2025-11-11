import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { decode, sign } from 'hono/jwt'
import { MockError } from 'mock-dash'
import z from 'zod'
import {
  getGetSession,
  postSignInEmail,
  postSignOut,
  postSignUpEmail,
  sessionModel,
  userModel,
} from './auth.gen'

export type User = z.infer<typeof userModel>
export type Session = z.infer<typeof sessionModel>

if (process.env.NODE_ENV !== 'production') {
  const mockContext = new Map<string, unknown>()

  postSignUpEmail.defineMock(async ({ honoContext, inputs }) => {
    const user = mockContext.get(`user.${inputs.json.email}`)

    if (user) {
      throw new MockError('Email already exists', 400)
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: inputs.json.email,
      name: inputs.json.name,
      image: inputs.json.image,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      updatedAt: new Date().toISOString(),
    }

    mockContext.set(`user.${inputs.json.email}.pass`, inputs.json.password)
    mockContext.set(`user.${inputs.json.email}`, newUser)

    const jwt = await createNewSession(honoContext, mockContext, newUser)
    setCookie(honoContext, 'jwt', jwt)

    return {
      token: jwt,
      user: newUser,
    }
  })

  postSignInEmail.defineMock(async ({ honoContext, inputs }) => {
    const password = mockContext.get(`user.${inputs.json.email}.pass`)

    if (password === undefined || inputs.json.password !== password) {
      throw new MockError('Incorrect password', 400)
    }

    const user = userModel.parse(mockContext.get(`user.${inputs.json.email}`))
    const jwt = await createNewSession(honoContext, mockContext, user)
    setCookie(honoContext, 'jwt', jwt)

    return {
      redirect: false,
      token: jwt,
      url: null,
      user,
    }
  })

  postSignOut.defineMock(({ honoContext }) => {
    const userParseResult = userModel.safeParse(honoContext.get('jwtPayload'))
    const jwt = getCookie(honoContext, 'jwt')
    deleteCookie(honoContext, 'jwt')

    const user = userParseResult.data
    if (!user) {
      return { success: true }
    }

    const sessionParseResult = z
      .array(sessionModel)
      .safeParse(mockContext.get(`session.${user.id}`))
    const sessions = sessionParseResult.data
    if (!sessions) {
      return { success: true }
    }

    if (jwt) {
      mockContext.set(
        `session.${user.id}`,
        sessions.filter((s) => jwt.includes(s.token)),
      )
    }

    return { success: true }
  })

  getGetSession.defineMock(({ honoContext }) => {
    const jwt = getCookie(honoContext, 'jwt')

    if (!jwt) {
      throw new MockError('Could not get session', 401)
    }

    const decodedJwt = decode(jwt)
    const userParseResult = userModel.safeParse(decodedJwt.payload)

    if (!userParseResult.success) {
      throw new MockError('Could not get session', 401)
    }

    const user = userParseResult.data
    const sessionParseResult = z
      .array(sessionModel)
      .safeParse(mockContext.get(`session.${user.id}`))

    if (!sessionParseResult.success) {
      throw new MockError('Could not get session', 401)
    }

    const session = sessionParseResult.data?.find((x) => x.userId === user.id)

    if (!session) {
      throw new MockError('Could not get session', 401)
    }

    return {
      session,
      user,
    }
  })

  async function createNewSession(
    honoContext: Context,
    mockContext: Map<string, unknown>,
    user: User,
  ) {
    const userAgent = honoContext.req.header('User-Agent') ?? ''

    const jwt = await sign(user, 'mockJwtSecret')
    const now = new Date()

    const parseResult = z
      .array(sessionModel)
      .safeParse(mockContext.get(`session.${user.id}`))

    const newSession: Session = {
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getDate() + 1).toISOString(),
      id: crypto.randomUUID(),
      ipAddress: '127.0.0.1',
      token: jwt,
      updatedAt: now.toISOString(),
      userAgent,
      userId: user.id,
    }
    mockContext.set(`session.${user.id}`, [
      newSession,
      ...(parseResult.data ?? []),
    ])

    return jwt
  }
}
