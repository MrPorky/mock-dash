import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <article>
      <header>
        <h2>Welcome to MockDash Demo</h2>
        <p>Choose a demo from the navigation above</p>
      </header>

      <div style={{ display: 'grid', gap: '1.5rem', marginTop: '2rem' }}>
        <div
          style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#3b82f6' }}>
            HTTP Methods Demo
          </h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
            Explore all HTTP methods (GET, POST, PUT, PATCH, DELETE) with a user
            management interface.
          </p>
          <a
            href="/http-demo"
            style={{
              color: '#3b82f6',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Try HTTP Demo →
          </a>
        </div>

        <div
          style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#06b6d4' }}>
            Streaming Demo
          </h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
            Experience real-time data streaming with Server-Sent Events (SSE)
            and JSON streaming.
          </p>
          <a
            href="/stream-demo"
            style={{
              color: '#06b6d4',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Try Streaming Demo →
          </a>
        </div>

        <div
          style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#a855f7' }}>
            WebSocket Demo
          </h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
            Test real-time bidirectional communication with chat and metrics
            WebSocket connections.
          </p>
          <a
            href="/ws-demo"
            style={{
              color: '#a855f7',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Try WebSocket Demo →
          </a>
        </div>
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <h3 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>
          Features Demonstrated
        </h3>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            REST API
          </span>
          <span
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            Server-Sent Events
          </span>
          <span
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            JSON Streaming
          </span>
          <span
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            WebSockets
          </span>
          <span
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            Real-time Communication
          </span>
        </div>
      </div>
    </article>
  )
}
