import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/header'

function RootLayout() {
  return (
    <main>
      <Header />
      <nav>
        <ul>
          <li>
            <Link to="/http-demo">Http</Link>
          </li>
          <li>
            <Link to="/stream-demo">Streaming</Link>
          </li>
          <li>
            <Link to="/ws-demo">WebSocket</Link>
          </li>
        </ul>
      </nav>
      <Outlet />
    </main>
  )
}

export const Route = createRootRoute({ component: RootLayout })
