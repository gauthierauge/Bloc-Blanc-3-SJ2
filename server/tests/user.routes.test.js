const { describe, it, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const userRoutes = require('../routes/user.routes');
const errorHandler = require('../middleware/errorHandler');

const SECRET = 'test-secret';

describe('user routes', () => {
    let server;
    let baseUrl;
    let query;

    const tokenFor = (id) => jwt.sign({ id }, SECRET);

    const get = (path, { token } = {}) => fetch(`${baseUrl}/api/users${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const mockDb = () => {
        query = mock.method(pool, 'query', async (sql) => {
            const row = { id: 7, username: 'alice' };
            if (sql.includes('email')) row.email = 'alice@example.com';
            return [[row]];
        });
    };

    before(async () => {
        process.env.JWT_SECRET = SECRET;
        const app = express();
        app.use(express.json());
        app.use('/api/users', userRoutes);
        app.use(errorHandler);
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    afterEach(() => mock.restoreAll());

    it('returns 401 on /me without a token', async () => {
        mockDb();

        const res = await get('/me');

        assert.equal(res.status, 401);
        assert.equal(query.mock.callCount(), 0);
    });

    it('returns the profile of the authenticated user with the email on /me', async () => {
        mockDb();

        const res = await get('/me', { token: tokenFor(7) });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.email, 'alice@example.com');
        assert.deepEqual(query.mock.calls[0].arguments[1], [7]);
    });

    it('does not return the email on the public profile', async () => {
        mockDb();

        const res = await get('/7');

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.email, undefined);
    });
});
