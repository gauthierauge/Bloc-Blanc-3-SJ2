const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db');
const controller = require('../controllers/comment.controller');

const createRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(body) {
            res.body = body;
            return res;
        },
    };
    return res;
};

const mockQueries = (...results) => {
    const queue = [...results];
    return mock.method(pool, 'query', async () => {
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next;
    });
};

const call = async (handler, req) => {
    const res = createRes();
    await handler({ params: { id: '1' }, query: {}, userId: 7, ...req }, res);
    return res;
};

const rowsOf = (count, firstId = count) => Array.from({ length: count }, (_, i) => ({ id: firstId - i }));

describe('comment controller', () => {
    beforeEach(() => mock.restoreAll());
    afterEach(() => mock.restoreAll());

    describe('getAllCommentsByArticle', () => {
        it('returns the comments of the requested article', async () => {
            const rows = [{ id: 1, content: 'hello', username: 'bob' }];
            const query = mockQueries([rows], [[{ total: 1 }]]);

            const res = await call(controller.getAllCommentsByArticle, {});

            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body, { comments: rows, total: 1, hasMore: false });
            assert.deepEqual(query.mock.calls[0].arguments[1], ['1', null, null, 21]);
            assert.deepEqual(query.mock.calls[1].arguments[1], ['1']);
        });

        it('returns an empty list when the article has no comment', async () => {
            mockQueries([[]], [[{ total: 0 }]]);

            const res = await call(controller.getAllCommentsByArticle, {});

            assert.deepEqual(res.body, { comments: [], total: 0, hasMore: false });
        });

        it('returns 20 comments and announces more when 21 are found', async () => {
            mockQueries([rowsOf(21)], [[{ total: 30 }]]);

            const res = await call(controller.getAllCommentsByArticle, {});

            assert.equal(res.body.comments.length, 20);
            assert.equal(res.body.total, 30);
            assert.equal(res.body.hasMore, true);
        });

        it('does not announce more with exactly 20 comments', async () => {
            mockQueries([rowsOf(20)], [[{ total: 20 }]]);

            const res = await call(controller.getAllCommentsByArticle, {});

            assert.equal(res.body.comments.length, 20);
            assert.equal(res.body.hasMore, false);
        });

        it('uses the before cursor as a query value', async () => {
            const query = mockQueries([[]], [[{ total: 0 }]]);

            await call(controller.getAllCommentsByArticle, { query: { before: '50' } });

            assert.deepEqual(query.mock.calls[0].arguments[1], ['1', '50', '50', 21]);
        });

        for (const before of ['abc', '1abc', '0', '-1', '', ['1', '2'], "1 OR 1=1"]) {
            it(`returns 400 for the before value ${JSON.stringify(before)}`, async () => {
                const query = mockQueries();

                const res = await call(controller.getAllCommentsByArticle, { query: { before } });

                assert.equal(res.statusCode, 400);
                assert.equal(query.mock.callCount(), 0);
            });
        }

        it('forwards a query failure to the error handler', async () => {
            mockQueries(new Error('db down'));

            await assert.rejects(call(controller.getAllCommentsByArticle, {}), /db down/);
        });
    });

    describe('createComment', () => {
        const invalidBodies = [
            ['a missing body', undefined],
            ['a missing content', {}],
            ['an empty content', { content: '' }],
            ['a whitespace-only content', { content: '   \n ' }],
            ['a non-string content', { content: { $gt: '' } }],
            ['a content over 5000 characters', { content: 'a'.repeat(5001) }],
        ];

        for (const [label, body] of invalidBodies) {
            it(`returns 400 for ${label}`, async () => {
                const query = mockQueries();

                const res = await call(controller.createComment, { body });

                assert.equal(res.statusCode, 400);
                assert.equal(query.mock.callCount(), 0);
            });
        }

        it('returns 404 when the article does not exist', async () => {
            const query = mockQueries([[]]);

            const res = await call(controller.createComment, { body: { content: 'hello' } });

            assert.equal(res.statusCode, 404);
            assert.equal(query.mock.callCount(), 1);
        });

        it('creates a trimmed comment and returns it with its author', async () => {
            const created = { id: 42, content: 'hello', username: 'alice', avatar: null };
            const query = mockQueries([[{ id: 1 }]], [{ insertId: 42 }], [[created]]);

            const res = await call(controller.createComment, { body: { content: '  hello  ' } });

            assert.equal(res.statusCode, 201);
            assert.deepEqual(res.body, created);
            assert.deepEqual(query.mock.calls[1].arguments[1], ['hello', '1', 7]);
            assert.deepEqual(query.mock.calls[2].arguments[1], [42]);
        });

        it('accepts a content of exactly 5000 characters', async () => {
            mockQueries([[{ id: 1 }]], [{ insertId: 42 }], [[{ id: 42 }]]);

            const res = await call(controller.createComment, { body: { content: 'a'.repeat(5000) } });

            assert.equal(res.statusCode, 201);
        });

        it('ignores a user_id sent by the client', async () => {
            const query = mockQueries([[{ id: 1 }]], [{ insertId: 42 }], [[{ id: 42 }]]);

            await call(controller.createComment, { body: { content: 'hello', user_id: 999 } });

            assert.equal(query.mock.calls[1].arguments[1][2], 7);
        });

        it('never places user content in the SQL text', async () => {
            const injection = "'); DROP TABLE comments; --";
            const query = mockQueries([[{ id: 1 }]], [{ insertId: 42 }], [[{ id: 42 }]]);

            await call(controller.createComment, { body: { content: injection } });

            const [sql, values] = query.mock.calls[1].arguments;
            assert.ok(!sql.includes(injection));
            assert.equal(values[0], injection);
        });

        it('forwards a query failure to the error handler', async () => {
            mockQueries(new Error('db down'));

            await assert.rejects(call(controller.createComment, { body: { content: 'hello' } }), /db down/);
        });
    });

    describe('updateCommentById', () => {
        it('returns 400 for a whitespace-only content', async () => {
            const query = mockQueries();

            const res = await call(controller.updateCommentById, { body: { content: '   ' } });

            assert.equal(res.statusCode, 400);
            assert.equal(query.mock.callCount(), 0);
        });

        it('returns 404 when the comment does not exist', async () => {
            const query = mockQueries([[]]);

            const res = await call(controller.updateCommentById, { body: { content: 'new' } });

            assert.equal(res.statusCode, 404);
            assert.equal(query.mock.callCount(), 1);
        });

        it('returns 403 and writes nothing for another user', async () => {
            const query = mockQueries([[{ user_id: 8 }]]);

            const res = await call(controller.updateCommentById, { body: { content: 'new' } });

            assert.equal(res.statusCode, 403);
            assert.equal(query.mock.callCount(), 1);
        });

        it('updates the targeted comment, not the one matching the user id', async () => {
            const query = mockQueries([[{ user_id: 7 }]], [{ affectedRows: 1 }]);

            const res = await call(controller.updateCommentById, {
                params: { id: '3' },
                body: { content: ' new ' },
            });

            assert.equal(res.statusCode, 200);
            assert.deepEqual(query.mock.calls[1].arguments[1], ['new', '3']);
        });
    });

    describe('deleteCommentById', () => {
        it('returns 404 when the comment does not exist', async () => {
            const query = mockQueries([[]]);

            const res = await call(controller.deleteCommentById, {});

            assert.equal(res.statusCode, 404);
            assert.equal(query.mock.callCount(), 1);
        });

        it('returns 403 and deletes nothing for another user', async () => {
            const query = mockQueries([[{ user_id: 8 }]]);

            const res = await call(controller.deleteCommentById, {});

            assert.equal(res.statusCode, 403);
            assert.equal(query.mock.callCount(), 1);
        });

        it('deletes the comment for its author', async () => {
            const query = mockQueries([[{ user_id: 7 }]], [{ affectedRows: 1 }]);

            const res = await call(controller.deleteCommentById, { params: { id: '3' } });

            assert.equal(res.statusCode, 200);
            assert.deepEqual(query.mock.calls[1].arguments[1], ['3']);
        });
    });
});
