import { didYouMean } from './middleware.js';

export { didYouMean, isMiddlewareEnabled, type DidYouMeanMiddleware } from './middleware.js';
export * from './types.js';
export * from './discovery/index.js';
export * from './matcher/index.js';
export * from './formatters/index.js';

export default didYouMean;
