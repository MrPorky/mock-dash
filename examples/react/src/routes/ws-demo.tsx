import type { apiSchema } from '@examples/shared'
import { createFileRoute } from '@tanstack/react-router'
import type { WebSocketController } from 'mock-dash'
import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/api/api-client'

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

export const Route = createFileRoute('/ws-demo')({
  component: RouteComponent,
})

function RouteComponent() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [chatInput, setChatInput] = useState('')
  const [selectedMetric, setSelectedMetric] = useState('cpu')
  const [isChatConnected, setIsChatConnected] = useState(false)
  const [isMetricsConnected, setIsMetricsConnected] = useState(false)
  const chatSocketRef = useRef<WebSocketController<
    typeof apiSchema.chatSocket.response
  > | null>(null)
  const metricsSocketRef = useRef<WebSocketController<
    typeof apiSchema.metricsSocket.response
  > | null>(null)

  const connectChatSocket = async () => {
    const { controller, data, error } = await apiClient.api.ws.chat.get.$ws()

    if (error) {
      console.error('WebSocket connection error:', error)
      setIsChatConnected(false)
      return
    }

    chatSocketRef.current = controller
    setIsChatConnected(true)

    try {
      for await (const chunk of data) {
        if (chunk.type === 'message') {
          setChatMessages((prev) => [...prev, chunk.data])
        }
      }
    } catch (err) {
      console.error('Chat socket error:', err)
    } finally {
      setIsChatConnected(false)
    }
  }

  const connectMetricsSocket = async () => {
    const { controller, data, error } = await apiClient.api.ws.metrics.get.$ws()

    if (error) {
      console.error('WebSocket connection error:', error)
      setIsMetricsConnected(false)
      return
    }

    metricsSocketRef.current = controller
    setIsMetricsConnected(true)

    try {
      for await (const chunk of data) {
        if (chunk.type === 'message') {
          setMetrics((prev) => [...prev, chunk.data])
        }
      }
    } catch (err) {
      console.error('Metrics socket error:', err)
    } finally {
      setIsMetricsConnected(false)
    }
  }

  const sendChatMessage = () => {
    if (!chatInput || !chatSocketRef.current) return

    const message = {
      id: String(Math.random()),
      user: 'You',
      message: chatInput,
      timestamp: new Date().toISOString(),
    }

    setChatMessages((prev) => [...prev, message])
    chatSocketRef.current.send(message)
    setChatInput('')
  }

  const sendMetricRequest = () => {
    if (!metricsSocketRef.current) return
    metricsSocketRef.current.send({ metric: selectedMetric })
  }

  const disconnectChat = () => {
    chatSocketRef.current?.close()
    chatSocketRef.current = null
    setIsChatConnected(false)
  }

  const disconnectMetrics = () => {
    metricsSocketRef.current?.close()
    metricsSocketRef.current = null
    setIsMetricsConnected(false)
  }

  useEffect(() => {
    return () => {
      chatSocketRef.current?.close()
      metricsSocketRef.current?.close()
      setIsChatConnected(false)
      setIsMetricsConnected(false)
    }
  }, [])

  return (
    <>
      <article>
        <header>
          <h2>Chat WebSocket</h2>
          <p>Real-time bidirectional communication</p>
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isChatConnected ? '#22c55e' : '#ef4444',
                color: 'white',
              }}
            >
              {isChatConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={connectChatSocket}
            className="btn-secondary"
            disabled={isChatConnected}
          >
            Connect Chat
          </button>
          <button
            type="button"
            onClick={disconnectChat}
            className="btn-secondary"
            disabled={!isChatConnected}
          >
            Disconnect
          </button>
        </div>

        <div className="chat-container">
          {chatMessages.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No messages yet.</p>
          ) : (
            chatMessages.map((msg, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: This is a demo
              <div key={idx} className="chat-message">
                <span className="message-user">{msg.user}</span>
                <span className="message-text">{msg.message}</span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex-row">
          <input
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
            type="text"
            disabled={!isChatConnected}
          />
          <button
            type="button"
            onClick={sendChatMessage}
            className="btn-secondary"
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
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isMetricsConnected ? '#22c55e' : '#ef4444',
                color: 'white',
              }}
            >
              {isMetricsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={connectMetricsSocket}
            className="btn-warning"
            disabled={isMetricsConnected}
          >
            Connect Metrics
          </button>
          <button
            type="button"
            onClick={disconnectMetrics}
            className="btn-warning"
            disabled={!isMetricsConnected}
          >
            Disconnect
          </button>
        </div>

        <div className="metrics-grid">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            disabled={!isMetricsConnected}
          >
            <option value="cpu">CPU</option>
            <option value="memory">Memory</option>
            <option value="disk">Disk</option>
            <option value="network">Network</option>
          </select>
          <button
            type="button"
            onClick={sendMetricRequest}
            className="btn-warning"
            disabled={!isMetricsConnected}
          >
            Request
          </button>
        </div>

        <div className="list-container">
          {metrics.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No metrics yet.</p>
          ) : (
            metrics.map((metric, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: This is a demo
              <div key={idx} className="event-item">
                <span className="event-type">{metric.metric}</span>
                <span className="event-data">
                  Value: {metric.value.toFixed(2)}
                </span>
                <span className="event-time">
                  {new Date(metric.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </>
  )
}
