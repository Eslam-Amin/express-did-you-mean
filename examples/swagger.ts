import express from 'express';
import { didYouMean } from '../src/index.js';

const app = express();
const port = 3001;

// Sample OpenAPI / Swagger specification
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Store API',
    version: '1.0.0',
  },
  paths: {
    '/api/v1/orders': {
      get: { summary: 'List all customer orders' },
      post: { summary: 'Create a new customer order' },
    },
    '/api/v1/orders/{orderId}': {
      get: { summary: 'Retrieve order by ID' },
      delete: { summary: 'Cancel an order' },
    },
    '/api/v1/inventory/items': {
      get: { summary: 'Query inventory warehouse' },
    },
  },
};

// Application endpoints
app.get('/api/v1/orders', (_req, res) => res.json({ orders: [] }));

// Use didYouMean with Swagger document
app.use(
  didYouMean({
    swaggerDoc: swaggerDocument,
    discoveryStrategy: 'swagger-first',
    maxSuggestions: 3,
    threshold: 0.35,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Swagger example listening on http://localhost:${port}`);
    console.log(`Try accessing: http://localhost:${port}/api/v1/ordrs`);
  });
}

export default app;
