import type { Request } from 'express';
import type { RouteSuggestion } from '../types.js';

export interface DefaultResponsePayload {
  statusCode: number;
  error: string;
  message: string;
  suggestions: RouteSuggestion[];
}

/**
 * Standard default JSON response formatter.
 */
export function defaultFormatResponse(
  suggestions: RouteSuggestion[],
  req: Request
): DefaultResponsePayload {
  return {
    statusCode: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    suggestions,
  };
}
