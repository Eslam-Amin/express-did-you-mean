import type { Request } from 'express';
import type { RouteSuggestion } from '../types.js';

/**
 * Standard JSON payload returned when an unregistered route triggers a 404 response.
 */
export interface DefaultResponsePayload {
  /** HTTP status code (typically 404) */
  statusCode: number;
  /** Short HTTP error status string */
  error: string;
  /** Detailed error message including method and requested path */
  message: string;
  /** List of top closest matching route suggestions */
  suggestions: RouteSuggestion[];
}

/**
 * Standard default JSON response formatter.
 *
 * @param suggestions - Array of ranked route suggestions meeting the threshold criteria.
 * @param req - The Express Request object representing the 404 request.
 * @returns Serialized JSON object matching the standard error structure.
 *
 * @example
 * ```typescript
 * const payload = defaultFormatResponse(suggestions, req);
 * ```
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

/**
 * Renders a clean, modern, developer-friendly HTML error page for browser requests.
 *
 * @param suggestions - Array of ranked route suggestions.
 * @param req - The incoming Express Request.
 * @returns Fully formatted HTML document string with styles and suggestion cards.
 *
 * @example
 * ```typescript
 * const html = renderHtml404(suggestions, req);
 * res.type('html').send(html);
 * ```
 */
export function renderHtml404(
  suggestions: RouteSuggestion[],
  req: Request
): string {
  const suggestionsList = suggestions.length > 0
    ? suggestions
        .map(
          (s) => `
      <li style="margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; list-style: none;">
        <span style="font-weight: 700; color: #2563eb; font-family: monospace; font-size: 13px; margin-right: 8px;">${s.method}</span>
        <code style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${s.path}</code>
        <span style="color: #64748b; font-size: 12px; margin-left: 8px;">(${(s.score * 100).toFixed(0)}% match${s.isMethodMismatch ? ' - method mismatch' : ''})</span>
        ${s.summary ? `<div style="color: #475569; font-size: 12px; margin-top: 4px;">${s.summary}</div>` : ''}
      </li>`
        )
        .join('')
    : '<li style="color: #64748b; list-style: none;">No close matches found.</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>404 Not Found - Did You Mean</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); max-width: 650px; width: 100%; padding: 32px; border: 1px solid #e2e8f0; }
    h1 { margin-top: 0; font-size: 22px; color: #dc2626; display: flex; align-items: center; gap: 8px; }
    .endpoint { font-family: monospace; background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 15px; }
    ul { padding: 0; margin: 16px 0 0 0; }
    .tag { display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="tag">Route Suggester (Dev Mode)</span>
    <h1>404 Not Found</h1>
    <p>Cannot find endpoint <span class="endpoint">${req.method} ${req.path}</span></p>
    <h3 style="margin-top: 24px; font-size: 16px; color: #334155;">Did you mean:</h3>
    <ul>
      ${suggestionsList}
    </ul>
  </div>
</body>
</html>`;
}
