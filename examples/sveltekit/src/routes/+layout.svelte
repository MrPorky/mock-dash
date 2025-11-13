<script lang='ts'>
import { page } from '$app/stores'
import favicon from '$lib/assets/favicon.svg'
import Header from '$lib/components/Header.svelte'
import './index.css'

const { children } = $props()
</script>

<svelte:head>
  <link rel='icon' href={favicon} />
</svelte:head>

<main>
  <Header />
  <nav>
    <ul>
      <li>
        <a href="/http-demo" class={$page.route.id === '/http-demo' ? 'active' : ''}>Http</a>
      </li>
      <li>
        <a href="/stream-demo" class={$page.route.id === '/stream-demo' ? 'active' : ''}>Streaming</a>
      </li>
      <li>
        <a href="/ws-demo" class={$page.route.id === '/ws-demo' ? 'active' : ''}>WebSocket</a>
      </li>
    </ul>
  </nav>
  {@render children?.()}
</main>

