const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const ALLOWED_ORIGIN = 'https://front.test';
process.env.CLIENT_URL = `${ALLOWED_ORIGIN}, https://other-front.test`;

const corsMiddleware = require('../config/cors');
const helmetMiddleware = require('../config/helmet');
const { loginLimiter } = require('../config/rateLimit');

describe('security middleware', () => {
    let server;
    let baseUrl;

    before(async () => {
        const app = express();
        app.use(helmetMiddleware);
        app.use(corsMiddleware);
        app.get('/ping', (req, res) => res.json({ ok: true }));
        app.post('/login-fail', loginLimiter, (req, res) => res.status(401).json({}));
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    it('allows every origin listed in CLIENT_URL', async () => {
        for (const origin of [ALLOWED_ORIGIN, 'https://other-front.test']) {
            const res = await fetch(`${baseUrl}/ping`, { headers: { Origin: origin } });
            assert.equal(res.headers.get('access-control-allow-origin'), origin);
        }
    });

    it('does not allow an unknown origin', async () => {
        const res = await fetch(`${baseUrl}/ping`, { headers: { Origin: 'https://evil.test' } });

        assert.equal(res.headers.get('access-control-allow-origin'), null);
    });

    it('lets the front load cross-origin resources', async () => {
        const res = await fetch(`${baseUrl}/ping`);

        assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    });

    it('sets the helmet security headers', async () => {
        const res = await fetch(`${baseUrl}/ping`);

        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('x-powered-by'), null);
    });

    it('blocks login attempts after 10 failures', async () => {
        const statuses = [];
        for (let i = 0; i < 11; i += 1) {
            const res = await fetch(`${baseUrl}/login-fail`, { method: 'POST' });
            statuses.push(res.status);
        }

        assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
        assert.equal(statuses[10], 429);
    });
});
