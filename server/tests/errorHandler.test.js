const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const upload = require('../middleware/upload');
const errorHandler = require('../middleware/errorHandler');

const SQL_ERROR = "Unknown column 'secret' in 'field list'";

describe('errorHandler', () => {
    let server;
    let baseUrl;
    let logged;

    before(async () => {
        const app = express();
        app.use(express.json());
        app.get('/async-failure', async () => {
            throw new Error(SQL_ERROR);
        });
        app.get('/sync-failure', () => {
            throw new Error(SQL_ERROR);
        });
        app.post('/json', (req, res) => res.json({ ok: true }));
        app.post('/upload', upload.single('image'), (req, res) => res.json({ ok: true }));
        app.use(errorHandler);
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    beforeEach(() => {
        logged = mock.method(console, 'error', () => {});
    });

    afterEach(() => mock.restoreAll());

    for (const path of ['/async-failure', '/sync-failure']) {
        it(`hides the details of ${path} from the client`, async () => {
            const res = await fetch(`${baseUrl}${path}`);
            const text = await res.text();

            assert.equal(res.status, 500);
            assert.deepEqual(JSON.parse(text), { message: 'Internal server error' });
            assert.ok(!text.includes('secret'));
        });

        it(`keeps the details of ${path} in the server logs`, async () => {
            await fetch(`${baseUrl}${path}`);

            assert.equal(logged.mock.callCount(), 1);
            assert.equal(logged.mock.calls[0].arguments[0].message, SQL_ERROR);
        });
    }

    it('returns 400 as JSON for a malformed JSON body', async () => {
        const res = await fetch(`${baseUrl}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ not json',
        });

        assert.equal(res.status, 400);
        assert.ok((await res.json()).message);
        assert.equal(logged.mock.callCount(), 0);
    });

    it('returns 400 with its message for a file that is not an image', async () => {
        const form = new FormData();
        form.append('image', new Blob(['text'], { type: 'text/plain' }), 'note.txt');

        const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });

        assert.equal(res.status, 400);
        assert.deepEqual(await res.json(), { message: 'Images only!' });
    });

    it('returns 400 for a file over the size limit', async () => {
        const form = new FormData();
        form.append('image', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'big.png');

        const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });

        assert.equal(res.status, 400);
        assert.equal((await res.json()).message, 'File too large');
    });
});
