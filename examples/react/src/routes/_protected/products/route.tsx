import { createFileRoute } from '@tanstack/react-router'
import { apiClient } from '@/api/api-client'
import styles from './products.module.css'

export const Route = createFileRoute('/_protected/products')({
  component: RouteComponent,
  loader: () => apiClient.products.get(),
})

function RouteComponent() {
  const { data: products, error } = Route.useLoaderData()

  if (error) {
    return <p>Error loading products: {String(error)}</p>
  }

  return (
    <>
      <h1>Our Products</h1>
      <p>
        A demonstration of data fetching and display using Svelte 5 and PicoCSS.
      </p>

      <div className={styles.pruducts}>
        {products.map((product) => (
          <article className={styles.pruduct} key={product.id}>
            <header>
              <h2>{product.name}</h2>
            </header>
            <p>{product.description}</p>
            <footer>
              <p>
                <strong>${product.price.toFixed(2)}</strong>
              </p>
              <button
                type="button"
                onClick={() => alert(`Added ${product.name} to cart!`)}
              >
                Add to cart
              </button>
            </footer>
          </article>
        ))}
      </div>
    </>
  )
}
