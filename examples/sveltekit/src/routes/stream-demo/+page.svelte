<script lang="ts">
import type { dataStreamModel, sseMessageModel } from '@examples/shared'
import type z from 'zod'
import { apiClient } from '$lib/api-client'

type SSEMessage = z.infer<typeof sseMessageModel>
type DataStreamItem = z.infer<typeof dataStreamModel>

let sseEvents: SSEMessage[] = $state([])
let jsonStream: DataStreamItem[] = $state([])
let loading = $state(false)

async function handleSSEStream() {
  loading = true
  sseEvents = []
  try {
    const { data, error } = await apiClient.events.get.$stream()

    if (error) throw new Error('Failed to start SSE stream')

    for await (const chunk of data) {
      if (chunk.type === 'event') {
        sseEvents = [...sseEvents, chunk.data]
      }
    }
  } catch (error) {
    console.error('Error streaming SSE:', error)
  } finally {
    loading = false
  }
}

async function handleJsonStream() {
  loading = true
  jsonStream = []
  try {
    const { data, error } = await apiClient.stream.json.get.$stream()
    if (error) throw new Error('Failed to start JSON stream')

    for await (const chunk of data) {
      if (chunk.type === 'json') {
        jsonStream = [...jsonStream, chunk.data]
      }
    }
  } catch (error) {
    console.error('Error streaming JSON:', error)
  } finally {
    loading = false
  }
}
</script>

<article>
  <header>
    <h2>Server-Sent Events (SSE)</h2>
    <p>Real-time streaming over HTTP</p>
  </header>

  <button
    type="button"
    onclick={handleSSEStream}
    disabled={loading}
    class="btn-info"
  >
    Start SSE Stream
  </button>

  <div class="list-container">
    {#if sseEvents.length === 0}
      <p style="color: #6b7280;">
        No events yet. Click the button to start streaming.
      </p>
    {:else}
      {#each sseEvents as event, idx (idx)}
        <div class="event-item">
          <span class="event-type">{event.type}</span>
          <span class="event-data">{event.data}</span>
          <span class="event-time">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
      {/each}
    {/if}
  </div>
</article>

<article>
  <header>
    <h2>JSON Streaming</h2>
    <p>Stream JSON lines for data processing</p>
  </header>

  <button
    type="button"
    onclick={handleJsonStream}
    disabled={loading}
    class="btn-success"
  >
    Start JSON Stream
  </button>

  <div class="list-container">
    {#if jsonStream.length === 0}
      <p style="color: #6b7280;">
        No data yet. Click the button to start streaming.
      </p>
    {:else}
      {#each jsonStream as item, idx (idx)}
        <div class="event-item">
          <span class="event-type">Index: {item.index}</span>
          <span class="event-data">{item.value}</span>
          <span class="event-time">
            {new Date(item.timestamp).toLocaleTimeString()}
          </span>
        </div>
      {/each}
    {/if}
  </div>
</article>