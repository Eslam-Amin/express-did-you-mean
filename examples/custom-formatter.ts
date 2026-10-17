import express from 'express';
import { didYouMean } from '../src/index.js';

const app = express();
const port = 3002;

app.get('/api/v1/users', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/accounts', (_req, res) => res.json({ ok: true }));

// Custom formatResponse matching prompt requirements
app.use(
  didYouMean({
    maxSuggestions: 3,
    threshold: 0.4,
    enabled: process.env.NODE_ENV !== 'production',
    formatResponse: (suggestions, req) => ({
      statusCode: 404,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      didYouMean: suggestions,
    }),
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Custom formatter example listening on http://localhost:${port}`);
    console.log(`Try accessing: http://localhost:${port}/api/v1/usr`);
  });
}

export default app;
