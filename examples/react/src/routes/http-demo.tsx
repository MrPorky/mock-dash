import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { apiClient } from '@/api/api-client'

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export const Route = createFileRoute('/http-demo')({
  component: RouteComponent,
})

function RouteComponent() {
  const [users, setUsers] = useState<User[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  const handleGetUsers = async () => {
    setLoading(true)
    try {
      const response = await apiClient.api.users.get({
        query: { page: 1, limit: 10 },
      })
      if (response.data) {
        setUsers(response.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!name || !email) return
    setLoading(true)
    try {
      const response = await apiClient.api.users.post({
        json: { name, email },
      })
      if (response.data) {
        setUsers([...users, response.data])
        setName('')
        setEmail('')
      }
    } catch (error) {
      console.error('Error creating user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUserId || !name || !email) return
    setLoading(true)
    try {
      const response = await apiClient.api.users.id(selectedUserId).put({
        json: { name, email },
      })

      if (response.data) {
        setUsers(
          users.map((u) => (u.id === selectedUserId ? response.data : u)),
        )
        setName('')
        setEmail('')
        setSelectedUserId('')
      }
    } catch (error) {
      console.error('Error updating user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePatchUser = async () => {
    if (!selectedUserId) return
    setLoading(true)
    try {
      const response = await apiClient.api.users.id(selectedUserId).patch({
        param: { id: selectedUserId },
        json: { name: name || undefined, email: email || undefined },
      })
      if (response.data) {
        setUsers(
          users.map((u) => (u.id === selectedUserId ? response.data : u)),
        )
        setName('')
        setEmail('')
        setSelectedUserId('')
      }
    } catch (error) {
      console.error('Error patching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    setLoading(true)
    try {
      await apiClient.api.users.id(userId).delete()
      setUsers(users.filter((u) => u.id !== userId))
    } catch (error) {
      console.error('Error deleting user:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <article>
      <header>
        <h2>User Management</h2>
        <p>Demonstrating all HTTP methods</p>
      </header>

      <form onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>Create or Edit User</legend>
          <div>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
            />
          </div>

          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="flex-row">
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={loading}
              className="btn-success"
            >
              POST - Create
            </button>
            <button
              type="button"
              onClick={handleUpdateUser}
              disabled={loading || !selectedUserId}
              className="btn-primary"
            >
              PUT - Update
            </button>
            <button
              type="button"
              onClick={handlePatchUser}
              disabled={loading || !selectedUserId}
              className="btn-secondary"
            >
              PATCH - Partial
            </button>
          </div>
        </fieldset>
      </form>

      <button
        type="button"
        onClick={handleGetUsers}
        disabled={loading}
        className="btn-primary"
      >
        GET - Fetch All Users
      </button>

      {users.length > 0 && (
        <div className="list-container">
          <strong>Users ({users.length})</strong>
          {users.map((user) => (
            <div
              key={user.id}
              className={`list-item ${selectedUserId === user.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedUserId(user.id)
                setName(user.name)
                setEmail(user.email)
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteUser(user.id)
                  }}
                  disabled={loading}
                  className="btn-danger"
                >
                  DELETE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
