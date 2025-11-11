import type { ServerLoad } from '@sveltejs/kit'
import { apiClient } from '$lib/api-client'

export const load: ServerLoad = async ({ fetch }) => {
  const { data: products } = await apiClient.products.get({ fetch })

  return {
    products,
  }
}
