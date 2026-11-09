const { describe, it, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const commentRoutes = require('../routes/comment.routes');
const errorHandler = require('../middleware/errorHandler');

const SECRET = 'test-secret';

describe('comment routes', () => {
    let server;
    let baseUrl;
    let query;

    const tokenFor = (id) => jwt.sign({ id }, SECRET);

    const send = (method, path, { token, body } = {}) => fetch(`${baseUrl}/api/comments${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const mockDb = (handler) => {
        query = mock.method(pool, 'query', async (sql) => handler(sql));
    };

    const happyDb = (sql) => {
        if (sql.includes('COUNT(*)')) return [[{ total: 0 }]];
        if (sql.startsWith('SELECT id FROM articles')) return [[{ id: 1 }]];
        if (sql.startsWith('INSERT')) return [{ insertId: 42 }];
        if (sql.startsWith('SELECT user_id')) return [[{ user_id: 7 }]];
        if (sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return [{ affectedRows: 1 }];
        return [[{ id: 42 }]];
    };

    before(async () => {
        process.env.JWT_SECRET = SECRET;
        const app = express();
        app.use(express.json());
        app.use('/api/comments', commentRoutes);
        app.use(errorHandler);
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    afterEach(() => mock.restoreAll());

    it('lets a visitor read the comments', async () => {
        mockDb(happyDb);

        const res = await send('GET', '/articles/1');

        assert.equal(res.status, 200);
    });

    const protectedRoutes = [
        ['POST', '/articles/1'],
        ['PUT', '/1'],
        ['DELETE', '/1'],
    ];

    for (const [method, path] of protectedRoutes) {
        it(`${method} ${path} refuses a request without a token`, async () => {
            mockDb(happyDb);

            const res = await send(method, path, { body: { content: 'hello' } });

            assert.equal(res.status, 401);
            assert.equal(query.mock.callCount(), 0);
        });

        it(`${method} ${path} refuses an invalid token`, async () => {
            mockDb(happyDb);

            const res = await send(method, path, { token: 'not-a-token', body: { content: 'hello' } });

            assert.equal(res.status, 401);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('creates a comment with a valid token', async () => {
        mockDb(happyDb);

        const res = await send('POST', '/articles/1', { token: tokenFor(101), body: { content: 'hello' } });

        assert.equal(res.status, 201);
    });

    it('lets the author update and delete a comment', async () => {
        mockDb(happyDb);
        const token = tokenFor(7);

        assert.equal((await send('PUT', '/1', { token, body: { content: 'new' } })).status, 200);
        assert.equal((await send('DELETE', '/1', { token })).status, 200);
    });

    it('refuses another user on update and delete', async () => {
        mockDb(happyDb);
        const token = tokenFor(8);

        assert.equal((await send('PUT', '/1', { token, body: { content: 'new' } })).status, 403);
        assert.equal((await send('DELETE', '/1', { token })).status, 403);
    });

    for (const id of ['abc', '1abc', '0', '-1', '1.5']) {
        it(`returns 400 for the id ${id} on every route`, async () => {
            mockDb(happyDb);
            const token = tokenFor(7);

            const statuses = [
                (await send('GET', `/articles/${id}`)).status,
                (await send('POST', `/articles/${id}`, { token, body: { content: 'hello' } })).status,
                (await send('PUT', `/${id}`, { token, body: { content: 'new' } })).status,
                (await send('DELETE', `/${id}`, { token })).status,
            ];

            assert.deepEqual(statuses, [400, 400, 400, 400]);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('hides database errors from the client', async () => {
        mock.method(console, 'error', () => {});
        mockDb(() => {
            throw new Error("Unknown column 'secret'");
        });

        const res = await send('GET', '/articles/1');

        assert.equal(res.status, 500);
        assert.deepEqual(await res.json(), { message: 'Internal server error' });
    });

    it('limits each user to 10 comments per minute', async () => {
        mockDb(happyDb);
        const token = tokenFor(200);
        const statuses = [];

        for (let i = 0; i < 11; i += 1) {
            const res = await send('POST', '/articles/1', { token, body: { content: 'hello' } });
            statuses.push(res.status);
        }

        assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
        assert.equal(statuses[10], 429);

        const otherUser = await send('POST', '/articles/1', { token: tokenFor(201), body: { content: 'hello' } });
        assert.equal(otherUser.status, 201);
    });
});
