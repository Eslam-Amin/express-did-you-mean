/**
 * express-did-you-mean
 *
 * Lightweight, production-ready Express 404 middleware that suggests closest
 * matching valid endpoints using Swagger/OpenAPI spec inspection and Express router stack traversal.
 *
 * @packageDocumentation
 */

import { didYouMean } from './middleware.js';

export { didYouMean, isMiddlewareEnabled, type DidYouMeanMiddleware } from './middleware.js';
export * from './types.js';
export * from './discovery/index.js';
export * from './matcher/index.js';
export * from './formatters/index.js';

export default didYouMean;
