const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pool } = require('../config/db');
const { createArticle, updateArticle } = require('../controllers/article.controller');

const VALID = { title: 'Mon article', content: 'Du contenu' };

const mockQueries = (...results) => {
    const queue = [...results];
    return mock.method(pool, 'query', async () => queue.shift());
};

const fakeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const callCreate = async ({ body, file } = {}) => {
    const res = fakeRes();
    await createArticle({ userId: 7, body, file }, res);
    return res;
};

const callUpdate = async ({ id = '1', body, file } = {}) => {
    const res = fakeRes();
    await updateArticle({ params: { id }, userId: 7, body, file }, res);
    return res;
};

const tempUpload = () => {
    const filePath = path.join(os.tmpdir(), `article-${process.pid}-${Date.now()}-${Math.random()}.png`);
    fs.writeFileSync(filePath, 'image');
    return { path: filePath, filename: path.basename(filePath) };
};

const invalidBodies = [
    ['a missing body', undefined],
    ['a missing title', { content: 'Du contenu' }],
    ['a whitespace-only title', { title: '   ', content: 'Du contenu' }],
    ['a title over 255 characters', { title: 'a'.repeat(256), content: 'Du contenu' }],
    ['a non-string title', { title: ['Mon article'], content: 'Du contenu' }],
    ['a missing content', { title: 'Mon article' }],
    ['a whitespace-only content', { title: 'Mon article', content: '   ' }],
    ['a content over 10000 characters', { title: 'Mon article', content: 'a'.repeat(10001) }],
    ['a non-string content', { title: 'Mon article', content: ['Du contenu'] }],
];

describe('createArticle', () => {
    afterEach(() => mock.restoreAll());

    for (const [label, body] of invalidBodies) {
        it(`returns 400 and writes nothing for ${label}`, async () => {
            const query = mockQueries();

            const res = await callCreate({ body });

            assert.equal(res.statusCode, 400);
            assert.ok(res.body.message);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('accepts a title of exactly 255 characters', async () => {
        mockQueries([{ insertId: 1 }]);

        const res = await callCreate({ body: { title: 'a'.repeat(255), content: 'Du contenu' } });

        assert.equal(res.statusCode, 201);
    });

    it('accepts a content of exactly 10000 characters', async () => {
        mockQueries([{ insertId: 1 }]);

        const res = await callCreate({ body: { title: 'Mon article', content: 'a'.repeat(10000) } });

        assert.equal(res.statusCode, 201);
    });

    it('stores the trimmed title and content of the authenticated user', async () => {
        const query = mockQueries([{ insertId: 1 }]);

        const res = await callCreate({ body: { title: '  Mon article  ', content: '  Du contenu  ' } });

        assert.equal(res.statusCode, 201);
        assert.deepEqual(query.mock.calls[0].arguments[1], ['Mon article', 'Du contenu', null, 7]);
    });

    it('removes the upload when the validation fails', async () => {
        mockQueries();
        const file = tempUpload();

        await callCreate({ body: { title: '', content: 'Du contenu' }, file });

        assert.equal(fs.existsSync(file.path), false);
    });

    it('keeps the upload when the article is created', async () => {
        mockQueries([{ insertId: 1 }]);
        const file = tempUpload();

        await callCreate({ body: VALID, file });

        assert.equal(fs.existsSync(file.path), true);
        fs.unlinkSync(file.path);
    });
});

describe('updateArticle', () => {
    afterEach(() => mock.restoreAll());

    for (const [label, body] of invalidBodies) {
        it(`returns 400 and reads nothing for ${label}`, async () => {
            const query = mockQueries();

            const res = await callUpdate({ body });

            assert.equal(res.statusCode, 400);
            assert.ok(res.body.message);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('removes the upload when the validation fails', async () => {
        mockQueries();
        const file = tempUpload();

        await callUpdate({ body: { title: 'a'.repeat(256), content: 'Du contenu' }, file });

        assert.equal(fs.existsSync(file.path), false);
    });

    it('returns 404 when the article does not exist', async () => {
        mockQueries([[]]);

        const res = await callUpdate({ body: VALID });

        assert.equal(res.statusCode, 404);
    });

    it('returns 403 for the article of another user', async () => {
        const query = mockQueries([[{ id: 1, user_id: 8, image: null }]]);

        const res = await callUpdate({ body: VALID });

        assert.equal(res.statusCode, 403);
        assert.equal(query.mock.callCount(), 1);
    });

    it('updates the trimmed title and content of its author', async () => {
        const query = mockQueries([[{ id: 1, user_id: 7, image: null }]], [{ affectedRows: 1 }]);

        const res = await callUpdate({ body: { title: '  Nouveau titre  ', content: '  Nouveau contenu  ' } });

        assert.equal(res.statusCode, 200);
        assert.deepEqual(query.mock.calls[1].arguments[1], ['Nouveau titre', 'Nouveau contenu', null, '1']);
    });
});
