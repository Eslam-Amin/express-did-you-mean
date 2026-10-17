import express from 'express';
import { describe, expect, it } from 'vitest';
import { extractExpressRoutes } from '../src/discovery/express.js';

describe('Express Router Stack Inspection', () => {
  it('extracts direct routes and methods on the application', () => {
    const app = express();
    app.get('/users', (_req, res) => res.send('ok'));
    app.post('/users', (_req, res) => res.send('ok'));
    app.delete('/users/:id', (_req, res) => res.send('ok'));

    const routes = extractExpressRoutes(app);
    expect(routes).toHaveLength(2);

    const usersRoute = routes.find((r) => r.path === '/users');
    expect(usersRoute).toBeDefined();
    expect(usersRoute?.methods.sort()).toEqual(['GET', 'POST']);

    const userById = routes.find((r) => r.path === '/users/:id');
    expect(userById).toBeDefined();
    expect(userById?.methods).toEqual(['DELETE']);
  });

  it('extracts routes from mounted express.Router() instances', () => {
    const app = express();
    const apiRouter = express.Router();

    apiRouter.get('/posts', (_req, res) => res.send('ok'));
    apiRouter.put('/posts/:id', (_req, res) => res.send('ok'));

    app.use('/api/v1', apiRouter);

    const routes = extractExpressRoutes(app);
    expect(routes).toHaveLength(2);

    const postsRoute = routes.find((r) => r.path === '/api/v1/posts');
    expect(postsRoute).toBeDefined();
    expect(postsRoute?.methods).toEqual(['GET']);

    const postByIdRoute = routes.find((r) => r.path === '/api/v1/posts/:id');
    expect(postByIdRoute).toBeDefined();
    expect(postByIdRoute?.methods).toEqual(['PUT']);
  });

  it('extracts deeply nested sub-routers', () => {
    const app = express();
    const rootRouter = express.Router();
    const nestedRouter = express.Router();

    nestedRouter.get('/details', (_req, res) => res.send('ok'));
    rootRouter.use('/sub', nestedRouter);
    app.use('/top', rootRouter);

    const routes = extractExpressRoutes(app);
    const targetRoute = routes.find((r) => r.path === '/top/sub/details');
    expect(targetRoute).toBeDefined();
    expect(targetRoute?.methods).toEqual(['GET']);
  });

  it('handles parameterized mount paths', () => {
    const app = express();
    const teamRouter = express.Router();

    teamRouter.get('/members', (_req, res) => res.send('ok'));
    app.use('/teams/:teamId', teamRouter);

    const routes = extractExpressRoutes(app);
    const memberRoute = routes.find((r) => r.path.includes('/teams') && r.path.includes('/members'));
    expect(memberRoute).toBeDefined();
    expect(memberRoute?.methods).toEqual(['GET']);
  });

  it('handles app.route chaining', () => {
    const app = express();
    app.route('/products')
      .get((_req, res) => res.send('ok'))
      .post((_req, res) => res.send('ok'))
      .delete((_req, res) => res.send('ok'));

    const routes = extractExpressRoutes(app);
    const productRoute = routes.find((r) => r.path === '/products');
    expect(productRoute).toBeDefined();
    expect(productRoute?.methods.sort()).toEqual(['DELETE', 'GET', 'POST']);
  });

  it('handles sub-applications', () => {
    const app = express();
    const adminApp = express();

    adminApp.get('/dashboard', (_req, res) => res.send('ok'));
    app.use('/admin', adminApp);

    const routes = extractExpressRoutes([app, adminApp]);
    const adminRoute = routes.find((r) => r.path === '/admin/dashboard');
    expect(adminRoute).toBeDefined();
    expect(adminRoute?.methods).toEqual(['GET']);
  });
});
