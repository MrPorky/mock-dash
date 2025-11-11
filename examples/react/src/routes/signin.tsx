import type { postSignInEmail } from '@examples/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { isValidationError } from 'mock-dash'
import type { AriaAttributes } from 'react'
import { useActionState } from 'react'
import z from 'zod'
import { apiClient } from '@/api/api-client'
import { CenterLayout } from '@/components/center-layout/center-layout'
import { ErrorParagraph } from '@/components/error-paragraph/error-paragraph'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/signin')({
  component: RouteComponent,
  validateSearch: z.object({
    redirect: z.string(),
  }),
})

type JSON = typeof postSignInEmail.$inferInputJson
type Errors = ReturnType<typeof z.treeifyError<JSON>>

function RouteComponent() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const { getSession } = useAuth()

  const [errors, fromAction, isSubmitting] = useActionState<
    Promise<Errors>,
    FormData
  >(
    async (_, formData) => {
      const data: JSON = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        rememberMe: formData.get('remember') as string,
        callbackURL: null,
      }

      try {
        await apiClient['sign-in'].email.post({ json: data })
        getSession()

        navigate({
          to: redirect,
        })
      } catch (error) {
        if (isValidationError(error)) {
          return z.treeifyError(error.validationErrors as z.ZodError<JSON>)
        } else {
          return {
            errors: ['Could not signin'],
            properties: {},
          }
        }
      }

      return {
        errors: [],
        properties: {},
      }
    },
    {
      errors: [],
      properties: {},
    },
  )

  function addFieldErrors(key: keyof JSON) {
    const err = errors.properties?.[key]
    if (err) {
      return {
        'aria-invalid': 'true',
        'aria-describedby': `${key}-helper`,
      } satisfies AriaAttributes
    }

    return {}
  }

  return (
    <CenterLayout>
      <article>
        <header>Signin</header>
        <form action={fromAction}>
          <label>
            Email
            <input
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              required
              type="text"
              name="email"
              {...addFieldErrors('email')}
            />
            {(errors.properties?.email?.errors ?? []).map((error) => (
              <small id="email-helper" key={error}>
                {error}
              </small>
            ))}
          </label>
          <label>
            Password
            <input
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              required
              type="password"
              name="password"
              {...addFieldErrors('password')}
            />
            {(errors.properties?.password?.errors ?? []).map((error) => (
              <small id="password-helper" key={error}>
                {error}
              </small>
            ))}
          </label>
          <fieldset>
            <label htmlFor="remember">
              <input
                role="switch"
                id="remember"
                type="checkbox"
                name="remember"
              />
              Remember me
            </label>
          </fieldset>
          <button disabled={isSubmitting} type="submit">
            Signin
          </button>

          {errors.errors.map((error) => (
            <ErrorParagraph key={error}>{error}</ErrorParagraph>
          ))}
          <small>
            Don't have an account?
            <Link to="/signup" search={{ redirect }}>
              signup
            </Link>
          </small>
        </form>
      </article>
    </CenterLayout>
  )
}
