import { faker } from '@faker-js/faker'
import { defineGet } from 'mock-dash'
import z from 'zod'
import { productModel } from '../models/product'

const productListModel = z.array(productModel)

export const getProducts = defineGet('/products', {
  response: productListModel,
})

if (process.env.NODE_ENV !== 'production') {
  getProducts.defineMock({
    length: 5,
    faker: () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: Number(faker.commerce.price()),
      description: faker.commerce.productDescription(),
    }),
  })
}
