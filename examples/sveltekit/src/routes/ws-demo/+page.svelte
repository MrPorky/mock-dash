<script lang="ts">
import type { WebSocketController } from 'mock-dash'
import { onDestroy } from 'svelte'
import type { apiSchema } from '$lib/api-client'
import { apiClient } from '$lib/api-client'

interface ChatMessage {
  id: string
  user: string
  message: string
  timestamp: string
}

interface MetricData {
  metric: string
  value: number
  timestamp: string
}

let chatMessages: ChatMessage[] = $state([])
let metrics: MetricData[] = $state([])
let chatInput = $state('')
let selectedMetric = $state('cpu')
let isChatConnected = $state(false)
let isMetricsConnected = $state(false)

let chatSocketRef: WebSocketController<
  typeof apiSchema.chatSocket.response
> | null = null

let metricsSocketRef: WebSocketController<
  typeof apiSchema.metricsSocket.response
> | null = null

async function connectChatSocket() {
  const { controller, data, error } = await apiClient.ws.chat.get.$ws()

  if (error) {
    console.error('WebSocket connection error:', error)
    isChatConnected = false
    return
  }

  chatSocketRef = controller
  isChatConnected = true

  try {
    for await (const chunk of data) {
      if (chunk.type === 'message') {
        chatMessages = [...chatMessages, chunk.data]
      }
    }
  } catch (err) {
    console.error('Chat socket error:', err)
  } finally {
    isChatConnected = false
  }
}

async function connectMetricsSocket() {
  const { controller, data, error } = await apiClient.ws.metrics.get.$ws()

  if (error) {
    console.error('WebSocket connection error:', error)
    isMetricsConnected = false
    return
  }

  metricsSocketRef = controller
  isMetricsConnected = true

  try {
    for await (const chunk of data) {
      if (chunk.type === 'message') {
        metrics = [...metrics, chunk.data]
      }
    }
  } catch (err) {
    console.error('Metrics socket error:', err)
  } finally {
    isMetricsConnected = false
  }
}

function sendChatMessage() {
  if (!chatInput || !chatSocketRef) return

  const message = {
    id: String(Math.random()),
    user: 'You',
    message: chatInput,
    timestamp: new Date().toISOString(),
  }

  chatMessages = [...chatMessages, message]
  chatSocketRef.send(message)
  chatInput = ''
}

function sendMetricRequest() {
  if (!metricsSocketRef) return
  metricsSocketRef.send({ metric: selectedMetric })
}

function disconnectChat() {
  chatSocketRef?.close()
  chatSocketRef = null
  isChatConnected = false
}

function disconnectMetrics() {
  metricsSocketRef?.close()
  metricsSocketRef = null
  isMetricsConnected = false
}

function handleKeyPress(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    sendChatMessage()
  }
}

onDestroy(() => {
  chatSocketRef?.close()
  metricsSocketRef?.close()
  isChatConnected = false
  isMetricsConnected = false
})
</script>

<article>
  <header>
    <h2>Chat WebSocket</h2>
    <p>Real-time bidirectional communication</p>
    <div style="margin-top: 8px;">
      <span
        style="
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          background-color: {isChatConnected ? '#22c55e' : '#ef4444'};
          color: white;
        "
      >
        {isChatConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  </header>

  <div style="display: flex; gap: 8px; margin-bottom: 16px;">
    <button
      type="button"
      onclick={connectChatSocket}
      class="btn-secondary"
      disabled={isChatConnected}
    >
      Connect Chat
    </button>
    <button
      type="button"
      onclick={disconnectChat}
      class="btn-secondary"
      disabled={!isChatConnected}
    >
      Disconnect
    </button>
  </div>

  <div class="chat-container">
    {#if chatMessages.length === 0}
      <p style="color: #6b7280;">No messages yet.</p>
    {:else}
      {#each chatMessages as msg, idx (idx)}
        <div class="chat-message">
          <span class="message-user">{msg.user}</span>
          <span class="message-text">{msg.message}</span>
          <span class="message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
      {/each}
    {/if}
  </div>

  <div class="flex-row">
    <input
      placeholder="Type a message..."
      bind:value={chatInput}
      onkeypress={handleKeyPress}
      type="text"
      disabled={!isChatConnected}
    />
    <button
      type="button"
      onclick={sendChatMessage}
      class="btn-secondary"
      disabled={!isChatConnected || !chatInput}
    >
      Send
    </button>
  </div>
</article>

<article>
  <header>
    <h2>Metrics WebSocket</h2>
    <p>Stream real-time metrics</p>
    <div style="margin-top: 8px;">
      <span
        style="
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          background-color: {isMetricsConnected ? '#22c55e' : '#ef4444'};
          color: white;
        "
      >
        {isMetricsConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  </header>

  <div style="display: flex; gap: 8px; margin-bottom: 16px;">
    <button
      type="button"
      onclick={connectMetricsSocket}
      class="btn-warning"
      disabled={isMetricsConnected}
    >
      Connect Metrics
    </button>
    <button
      type="button"
      onclick={disconnectMetrics}
      class="btn-warning"
      disabled={!isMetricsConnected}
    >
      Disconnect
    </button>
  </div>

  <div class="metrics-grid">
    <select bind:value={selectedMetric} disabled={!isMetricsConnected}>
      <option value="cpu">CPU</option>
      <option value="memory">Memory</option>
      <option value="disk">Disk</option>
      <option value="network">Network</option>
    </select>
    <button
      type="button"
      onclick={sendMetricRequest}
      class="btn-warning"
      disabled={!isMetricsConnected}
    >
      Request
    </button>
  </div>

  <div class="list-container">
    {#if metrics.length === 0}
      <p style="color: #6b7280;">No metrics yet.</p>
    {:else}
      {#each metrics as metric, idx (idx)}
        <div class="event-item">
          <span class="event-type">{metric.metric}</span>
          <span class="event-data">
            Value: {metric.value.toFixed(2)}
          </span>
          <span class="event-time">
            {new Date(metric.timestamp).toLocaleTimeString()}
          </span>
        </div>
      {/each}
    {/if}
  </div>
</article>