import { deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { jwt } from 'hono/jwt'
import { createMockServer } from 'mock-dash'
import { zocker } from 'zocker'
import * as apiSchema from '../schemas'

const app = createMockServer(apiSchema, {
  // @ts-expect-error zocker types are not aligned with zod types
  zodToMock: (s) => zocker(s).generate(),
  addMiddleware: (app) => {
    app.onError((err, c) => {
      if (err instanceof HTTPException && err.status === 401) {
        deleteCookie(c, 'jwt')

        return err.getResponse()
      }

      return c.text('Internal Server Error', 500)
    })

    app.use(
      '/products/*',
      jwt({
        secret: 'mockJwtSecret',
        cookie: 'jwt',
      }),
    )
  },
  base: '/api',
})

export default app
