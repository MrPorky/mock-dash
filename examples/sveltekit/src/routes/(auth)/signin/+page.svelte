<script lang='ts'>
import type { postSignInEmail } from '@examples/shared'
import { isValidationError } from 'mock-dash'
import type { AriaAttributes } from 'svelte/elements'
import z from 'zod'
import { goto } from '$app/navigation'
import { apiClient } from '$lib/api-client'
import CenterLayout from '$lib/components/CenterLayout.svelte'
import ErrorParagraph from '$lib/components/ErrorParagraph.svelte'
import type { PageProps } from './$types'

const { data }: PageProps = $props()
const { redirect } = data

type JSON = typeof postSignInEmail.$inferInputJson

let errors = $state<ReturnType<typeof z.treeifyError<JSON>>>({
  errors: [],
  properties: {},
})

async function handleSubmit(
  event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement },
) {
  errors = { errors: [], properties: {} }
  event.preventDefault()
  const formData = new FormData(event.currentTarget, event.submitter)
  const data: JSON = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    rememberMe: formData.get('remember') as string,
    callbackURL: null,
  }

  try {
    await apiClient['sign-in'].email.post({ json: data })

    goto(redirect)
  } catch (error) {
    if (isValidationError(error)) {
      errors = z.treeifyError(error.validationErrors as z.ZodError<JSON>)
    } else {
      errors = {
        errors: ['Could not signin'],
        properties: {},
      }
    }
  }
}

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
</script>

<svelte:head>
  <title>Sign up</title>
</svelte:head>

<CenterLayout>
  <article>
    <header>Signup</header>
    <form onsubmit={handleSubmit}>
      <label>
        Email
        <input
          placeholder='Email'
          aria-label='Email'
          autocomplete='email'
          required
          type='text'
          name='email'
          {...addFieldErrors('email')}
        />
        {#each errors.properties?.email?.errors ?? [] as error}
          <small id='email-helper'>{error}</small>
        {/each}
      </label>
      <label>
        Password
        <input
          placeholder='Password'
          aria-label='Password'
          autocomplete='current-password'
          required
          type='password'
          name='password'
          {...addFieldErrors('password')}
        />
        {#each errors.properties?.password?.errors ?? [] as error}
          <small id='password-helper'>{error}</small>
        {/each}
      </label>
      <fieldset>
        <label for='remember'>
          <input
            role='switch'
            id='remember'
            type='checkbox'
            name='remember'
          />Remember me</label
        >
      </fieldset>
      <button type='submit'>Signin</button>
      {#each errors.errors as error}
        <ErrorParagraph msg={error} />
      {/each}
      <small>Don't have an account? <a href='/signup'>signup</a></small>
    </form>
  </article>
</CenterLayout>
