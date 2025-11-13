<script lang="ts">
import type { userModel } from '@examples/shared'
import type z from 'zod'
import { apiClient } from '$lib/api-client'

type User = z.infer<typeof userModel>

let users: User[] = $state([])
let name = $state('')
let email = $state('')
let loading = $state(false)
let selectedUserId = $state('')

async function handleGetUsers() {
  loading = true
  try {
    const response = await apiClient.users.get({
      query: { page: 1, limit: 10 },
    })
    if (response.data) {
      users = response.data
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    loading = false
  }
}

async function handleCreateUser() {
  if (!name || !email) return
  loading = true
  try {
    const response = await apiClient.users.post({
      json: { name, email },
    })
    if (response.data) {
      users = [...users, response.data]
      name = ''
      email = ''
    }
  } catch (error) {
    console.error('Error creating user:', error)
  } finally {
    loading = false
  }
}

async function handleUpdateUser() {
  if (!selectedUserId || !name || !email) return
  loading = true
  try {
    const response = await apiClient.users.id(selectedUserId).put({
      json: { name, email },
    })

    if (response.data) {
      users = users.map((u) => (u.id === selectedUserId ? response.data : u))
      name = ''
      email = ''
      selectedUserId = ''
    }
  } catch (error) {
    console.error('Error updating user:', error)
  } finally {
    loading = false
  }
}

async function handlePatchUser() {
  if (!selectedUserId) return
  loading = true
  try {
    const response = await apiClient.users.id(selectedUserId).patch({
      json: { name: name || undefined, email: email || undefined },
    })
    if (response.data) {
      users = users.map((u) => (u.id === selectedUserId ? response.data : u))
      name = ''
      email = ''
      selectedUserId = ''
    }
  } catch (error) {
    console.error('Error patching user:', error)
  } finally {
    loading = false
  }
}

async function handleDeleteUser(userId: string) {
  loading = true
  try {
    await apiClient.users.id(userId).delete()
    users = users.filter((u) => u.id !== userId)
  } catch (error) {
    console.error('Error deleting user:', error)
  } finally {
    loading = false
  }
}

function selectUser(user: User) {
  selectedUserId = user.id
  name = user.name
  email = user.email
}

function handleSubmit(e: Event) {
  e.preventDefault()
}
</script>

<article>
  <header>
    <h2>User Management</h2>
    <p>Demonstrating all HTTP methods</p>
  </header>

  <form onsubmit={handleSubmit}>
    <fieldset>
      <legend>Create or Edit User</legend>
      <div>
        <label for="name">Name</label>
        <input
          id="name"
          placeholder="Enter name"
          bind:value={name}
          type="text"
        />
      </div>

      <div>
        <label for="email">Email</label>
        <input
          id="email"
          placeholder="Enter email"
          bind:value={email}
          type="email"
        />
      </div>

      <div class="flex-row">
        <button
          type="button"
          onclick={handleCreateUser}
          disabled={loading}
          class="btn-success"
        >
          POST - Create
        </button>
        <button
          type="button"
          onclick={handleUpdateUser}
          disabled={loading || !selectedUserId}
          class="btn-primary"
        >
          PUT - Update
        </button>
        <button
          type="button"
          onclick={handlePatchUser}
          disabled={loading || !selectedUserId}
          class="btn-secondary"
        >
          PATCH - Partial
        </button>
      </div>
    </fieldset>
  </form>

  <button
    type="button"
    onclick={handleGetUsers}
    disabled={loading}
    class="btn-primary"
  >
    GET - Fetch All Users
  </button>

  {#if users.length > 0}
    <div class="list-container">
      <strong>Users ({users.length})</strong>
      {#each users as user (user.id)}
        <div
          class="list-item {selectedUserId === user.id ? 'selected' : ''}"
          onclick={() => selectUser(user)}
        >
          <div
            style="display: flex; justify-content: space-between; align-items: center;"
          >
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation()
                handleDeleteUser(user.id)
              }}
              disabled={loading}
              class="btn-danger"
            >
              DELETE
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</article>