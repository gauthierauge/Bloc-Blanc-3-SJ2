const { describe, it, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const articleRoutes = require('../routes/article.routes');
const errorHandler = require('../middleware/errorHandler');

const SECRET = 'test-secret';

describe('article routes', () => {
    let server;
    let baseUrl;
    let query;

    const tokenFor = (id) => jwt.sign({ id }, SECRET);

    const send = (method, path, { token, body } = {}) => fetch(`${baseUrl}/api/articles${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const mockDb = () => {
        query = mock.method(pool, 'query', async () => [[{ id: 1, title: 'Mon article', user_id: 7 }]]);
    };

    before(async () => {
        process.env.JWT_SECRET = SECRET;
        const app = express();
        app.use(express.json());
        app.use('/api/articles', articleRoutes);
        app.use(errorHandler);
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    afterEach(() => mock.restoreAll());

    const invalidIds = ['abc', '0', '-1', '1.5'];

    for (const id of invalidIds) {
        it(`returns 400 without reading the database for GET /${id}`, async () => {
            mockDb();

            const res = await send('GET', `/${id}`);

            assert.equal(res.status, 400);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('returns 400 for PUT /abc', async () => {
        mockDb();

        const res = await send('PUT', '/abc', {
            token: tokenFor(7),
            body: { title: 'Mon article', content: 'Du contenu' },
        });

        assert.equal(res.status, 400);
        assert.equal(query.mock.callCount(), 0);
    });

    it('returns 400 for DELETE /abc', async () => {
        mockDb();

        const res = await send('DELETE', '/abc', { token: tokenFor(7) });

        assert.equal(res.status, 400);
        assert.equal(query.mock.callCount(), 0);
    });

    it('still returns an article for a valid id', async () => {
        mockDb();

        const res = await send('GET', '/1');

        assert.equal(res.status, 200);
    });
});
