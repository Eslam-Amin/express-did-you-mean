# express-did-you-mean

> Lightweight, production-ready Express 404 middleware that intelligently suggests closest matching endpoints using Swagger/OpenAPI specs and Express router stack inspection.

[![npm version](https://img.shields.io/badge/npm-v1.0.2-blue.svg)](https://www.npmjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

When developers or API clients hit an unregistered route that results in a `404 Not Found`, diagnosing typos, version mismatches, or incorrect HTTP methods can be frustrating.

`express-did-you-mean` catches missing routes and instantly suggests the closest matching valid endpoints:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /api/v1/usr",
  "suggestions": [
    {
      "method": "GET",
      "path": "/api/v1/users",
      "score": 0.88,
      "isMethodMismatch": false
    },
    {
      "method": "POST",
      "path": "/api/v1/users",
      "score": 0.81,
      "isMethodMismatch": false
    }
  ]
}
```

---

## Key Features

- **Route Discovery Strategy (Swagger First, Express Fallback)**:
  - **Priority 1 (Swagger / OpenAPI):** Automatically harvests paths, HTTP methods, operation IDs, and summaries from OpenAPI 2.0 (Swagger) and OpenAPI 3.0/3.1 specs (via JS Object, local JSON file, or remote URL).
  - **Priority 2 (Express Router Stack Inspection):** Recursively inspects `app._router.stack` (or Express 5 `app.router.stack`), traversing nested `express.Router()` layers, sub-routers, mountpaths, and chained routes.
- **Fuzzy Matching & Ranking Engine**:
  - Multi-signal string similarity: Levenshtein distance, Jaro-Winkler (prefix-biased), Sørensen-Dice, and a weighted hybrid path token matcher.
  - Parameterized pattern normalization: correctly recognizes that `/api/v1/users/42` matches `/api/v1/users/:id` or `/api/v1/users/{userId}`.
  - Prioritizes exact path matches with mismatched HTTP methods (e.g. client invoked `POST /orders`, but only `GET /orders` is registered).
- **Environment Guardrails**:
  - Active **only** in non-production environments by default (`process.env.NODE_ENV !== 'production'`).
  - Transparent zero-overhead no-op in production (`return next()`) with zero router traversals or string comparisons.
- **Production-Ready DX**:
  - Dual CommonJS & ESM build with full TypeScript typings.
  - Zero external runtime dependencies.
  - Fully customizable response formatting (`formatResponse`) and custom error handling hook (`onNotFound`).
  - Automatic content negotiation: returns developer-friendly HTML for browser requests or clean JSON for API clients.

---

## Installation

```bash
npm install express-did-you-mean
```

*Peer dependency: `express >= 4.17.0` (supports Express 4 and Express 5).*

---

## Quick Start

```typescript
import express from 'express';
import { didYouMean } from 'express-did-you-mean';

const app = express();

// 1. Register your application routes
app.get('/api/v1/users', (req, res) => res.json({ users: [] }));
app.post('/api/v1/users', (req, res) => res.status(201).json({ created: true }));
app.get('/api/v1/users/:id', (req, res) => res.json({ id: req.params.id }));
app.get('/api/v1/products', (req, res) => res.json({ products: [] }));

// 2. Attach didYouMean at the bottom of the middleware chain
app.use(didYouMean());

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

When a client requests `GET /api/v1/usr`, the response is:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /api/v1/usr",
  "suggestions": [
    {
      "method": "GET",
      "path": "/api/v1/users",
      "score": 0.88,
      "isMethodMismatch": false
    }
  ]
}
```

---

## Architecture & Workflow

```mermaid
flowchart TD
    Req[Incoming Request] --> RouterCheck{Route Matched?}
    RouterCheck -- Yes --> Handler[Route Handler (200 / 201)]
    RouterCheck -- No / 404 --> Middleware[didYouMean Middleware]
    
    Middleware --> EnvCheck{Enabled in Environment?}
    EnvCheck -- No (Production) --> NextHandler[next() -> Standard Production 404]
    
    EnvCheck -- Yes (Dev/Staging) --> Discovery{Routes in Cache?}
    Discovery -- Yes --> Ranker
    Discovery -- No --> Harvest[Harvest Routes]
    
    Harvest --> SwaggerCheck{Swagger Spec Provided?}
    SwaggerCheck -- Yes --> ParseSwagger[Parse OpenAPI / Swagger Spec]
    SwaggerCheck -- No --> InspectExpress[Inspect Express Router Stack]
    ParseSwagger --> Merge[Merge & Supplement Routes]
    InspectExpress --> Merge
    Merge --> Cache[Cache Route Table]
    
    Cache --> Ranker[Fuzzy Matcher & Ranker]
    Ranker --> Score[Normalize Path & Compare Methods]
    Score --> Format{Custom Formatter?}
    Format -- Yes --> CustomJSON[Send Custom JSON]
    Format -- No --> ContentNeg{Client Accepts HTML?}
    ContentNeg -- HTML --> HTMLPage[Render Developer HTML Card]
    ContentNeg -- JSON --> DefaultJSON[Send Standard JSON 404]
```

---

## Configuration Options

Pass an options object to `didYouMean(options)`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `swaggerDoc` | `object \| string` | `undefined` | OpenAPI 2.0 or 3.x spec (parsed object, local file path, or URL). |
| `discoveryStrategy` | `'swagger-first' \| 'swagger-only' \| 'express-only' \| 'combine'` | `'swagger-first'` | Strategy for resolving endpoints across the app. |
| `maxSuggestions` | `number` | `3` | Maximum number of route suggestions to return. |
| `threshold` | `number` | `0.4` | Minimum similarity score (0.0 to 1.0) required to include a route. |
| `algorithm` | `'hybrid' \| 'levenshtein' \| 'jaro-winkler' \| 'dice'` | `'hybrid'` | Similarity metric used to rank path closeness. |
| `enabled` | `boolean \| ((req: Request) => boolean)` | `process.env.NODE_ENV !== 'production'` | Explicit toggle or request-level predicate function. |
| `enabledEnvironments` | `string[]` | `undefined` | Whitelist of `NODE_ENV` values where middleware is active (e.g. `['development', 'staging', 'test']`). |
| `statusCode` | `number` | `404` | HTTP response status code. |
| `formatResponse` | `(suggestions, req) => any` | Default JSON formatter | Custom response builder returning JSON serializable data. |
| `onNotFound` | `(req, res, suggestions, next) => void` | `undefined` | Custom hook for full control over response, headers, or forwarding. |
| `excludeRoutes` | `(string \| RegExp)[]` | `[]` | Routes or regex patterns to omit from suggestions (e.g. `['/health', /^\/_/ ]`). |
| `includeMethods` | `HttpMethod[]` | `undefined` | Filter which HTTP methods should be suggested. |
| `caseSensitive` | `boolean` | `false` | Whether path comparisons should be case-sensitive. |
| `cacheRoutes` | `boolean` | `true` | Whether discovered routes are cached in memory. |
| `includeMethodMismatches` | `boolean` | `true` | Prioritizes endpoints that match the exact path but support other HTTP methods. |

---

## Usage Examples

### 1. Custom Response Formatting

Match custom API standards using `formatResponse`:

```typescript
import express from 'express';
import { didYouMean } from 'express-did-you-mean';

const app = express();

app.use(didYouMean({
  maxSuggestions: 3,
  threshold: 0.4,
  enabled: process.env.NODE_ENV !== 'production',
  formatResponse: (suggestions, req) => ({
    statusCode: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    didYouMean: suggestions // [{ method: 'GET', path: '/api/v1/users', score: 0.88 }]
  })
}));
```

### 2. OpenAPI / Swagger Document Integration

Pass a parsed OpenAPI object, a local file path, or an HTTP URL:

```typescript
import swaggerDocument from './swagger.json';

app.use(didYouMean({
  swaggerDoc: swaggerDocument,
  discoveryStrategy: 'swagger-first', // Uses Swagger spec, supplements with Express routes
  threshold: 0.35,
}));
```

Or load dynamically from a local file or remote endpoint:

```typescript
app.use(didYouMean({
  swaggerDoc: './docs/openapi.json', // or 'https://api.example.com/openapi.json'
}));
```

### 3. Method Mismatch Detection

When a client hits a path with the wrong HTTP method (e.g. `POST /api/v1/users` instead of `GET /api/v1/users`), `express-did-you-mean` identifies this and gives it top priority:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot DELETE /api/v1/users",
  "suggestions": [
    {
      "method": "GET",
      "path": "/api/v1/users",
      "score": 1.0,
      "isMethodMismatch": true
    },
    {
      "method": "POST",
      "path": "/api/v1/users",
      "score": 1.0,
      "isMethodMismatch": true
    }
  ]
}
```

### 4. Custom `onNotFound` Hook

If you want custom logging, metrics tracking, or header customization:

```typescript
app.use(didYouMean({
  onNotFound: (req, res, suggestions, next) => {
    // Log route suggestion telemetry
    logger.warn(`404 on ${req.method} ${req.path}. Top suggestion: ${suggestions[0]?.path}`);

    res.setHeader('X-Route-Suggestions', suggestions.length.toString());
    res.status(404).json({
      error: 'Resource not found',
      closestMatches: suggestions
    });
  }
}));
```

### 5. Standalone Utilities

All underlying route discovery, fuzzy similarity algorithms, and rankers are also exported for standalone usage:

```typescript
import {
  extractExpressRoutes,
  extractRoutesFromSwaggerObject,
  rankRoutes,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  diceSimilarity
} from 'express-did-you-mean';

// Inspect an Express application
const routes = extractExpressRoutes(app);

// Fuzzy rank routes manually
const suggestions = rankRoutes('GET', '/usrs', routes, { threshold: 0.5 });
```

---

## Cache Management

By default, route inspection is cached on the first 404 request for maximum efficiency. If your application dynamically mounts routes at runtime:

```typescript
const suggester = didYouMean();
app.use(suggester);

// Clear the cache whenever routes change dynamically
suggester.clearCache();
```

---

## Performance Guardrails

- **Zero overhead in production**: The middleware evaluates `process.env.NODE_ENV !== 'production'` as the very first line of code. In production, control immediately yields to `next()` without performing router inspection, memory allocations, or string comparisons.
- **Memoized Route Extraction**: Discovered route trees are memoized after the first traversal. Subsequent 404 calls only perform fast in-memory string scoring.
- **Zero Runtime Dependencies**: Written entirely in pure TypeScript using standard Node.js APIs (`fs`, `path`, and native `fetch`).

---

## Testing

The package includes a comprehensive test suite covering all discovery strategies, Express router stacks, algorithms, and integration cases:

```bash
# Run unit & integration tests
npm test

# Run tests with code coverage
npm run test:coverage
```

---

## License

MIT © [Eslam Amin](https://github.com/Eslam-Amin)

---

npm-recovery-claim: eslam-amin - 2026-10-31
