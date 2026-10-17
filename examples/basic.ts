import express from 'express';
import { didYouMean } from '../src/index.js';

const app = express();
const port = 3000;

// Register sample application routes
app.get('/api/v1/users', (_req, res) => {
  res.json({ users: [{ id: 1, name: 'Alice' }] });
});

app.post('/api/v1/users', (_req, res) => {
  res.status(201).json({ id: 2, name: 'Bob' });
});

app.get('/api/v1/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'User' });
});

app.get('/api/v1/products', (_req, res) => {
  res.json({ products: [] });
});

// Attach didYouMean at the end of the routing chain
app.use(
  didYouMean({
    maxSuggestions: 3,
    threshold: 0.4,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Basic example listening on http://localhost:${port}`);
    console.log(`Try accessing: http://localhost:${port}/api/v1/usr`);
  });
}

export default app;
