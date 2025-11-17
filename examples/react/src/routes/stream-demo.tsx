import type { dataStreamModel, sseMessageModel } from '@examples/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type z from 'zod'
import { apiClient } from '@/api/api-client'

export const Route = createFileRoute('/stream-demo')({
  component: RouteComponent,
})

type SSEMessage = z.infer<typeof sseMessageModel>
type DataStreamItem = z.infer<typeof dataStreamModel>

function RouteComponent() {
  const [sseEvents, setSseEvents] = useState<SSEMessage[]>([])
  const [jsonStream, setJsonStream] = useState<DataStreamItem[]>([])
  const [loading, setLoading] = useState(false)

  const handleSSEStream = async () => {
    setLoading(true)
    setSseEvents([])
    try {
      const { data, error } = await apiClient.api.events.get.$stream()

      if (error) throw new Error('Failed to start SSE stream')

      for await (const chunk of data) {
        if (chunk.type === 'event') {
          setSseEvents((prev) => [...prev, chunk.data])
        }
      }
    } catch (error) {
      console.error('Error streaming SSE:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJsonStream = async () => {
    setLoading(true)
    setJsonStream([])
    try {
      const { data, error } = await apiClient.api.stream.json.get.$stream()
      if (error) throw new Error('Failed to start JSON stream')

      for await (const chunk of data) {
        if (chunk.type === 'json') {
          setJsonStream((prev) => [...prev, chunk.data])
        }
      }
    } catch (error) {
      console.error('Error streaming JSON:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <article>
        <header>
          <h2>Server-Sent Events (SSE)</h2>
          <p>Real-time streaming over HTTP</p>
        </header>

        <button
          type="button"
          onClick={handleSSEStream}
          disabled={loading}
          className="btn-info"
        >
          Start SSE Stream
        </button>

        <div className="list-container">
          {sseEvents.length === 0 ? (
            <p style={{ color: '#6b7280' }}>
              No events yet. Click the button to start streaming.
            </p>
          ) : (
            sseEvents.map((event, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: This is a demo
              <div key={idx} className="event-item">
                <span className="event-type">{event.type}</span>
                <span className="event-data">{event.data}</span>
                <span className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </article>

      <article>
        <header>
          <h2>JSON Streaming</h2>
          <p>Stream JSON lines for data processing</p>
        </header>

        <button
          type="button"
          onClick={handleJsonStream}
          disabled={loading}
          className="btn-success"
        >
          Start JSON Stream
        </button>

        <div className="list-container">
          {jsonStream.length === 0 ? (
            <p style={{ color: '#6b7280' }}>
              No data yet. Click the button to start streaming.
            </p>
          ) : (
            jsonStream.map((item, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: This is a demo
              <div key={idx} className="event-item">
                <span className="event-type">Index: {item.index}</span>
                <span className="event-data">{item.value}</span>
                <span className="event-time">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </>
  )
}
