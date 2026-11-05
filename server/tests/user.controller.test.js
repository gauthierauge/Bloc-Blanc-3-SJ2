const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { updateProfile } = require('../controllers/user.controller');

const VALID = { username: 'alice', bio: 'hello' };

const mockQueries = (...results) => {
    const queue = [...results];
    return mock.method(pool, 'query', async () => queue.shift());
};

const callUpdate = async ({ id = '7', body, file } = {}) => {
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
    await updateProfile({ params: { id }, userId: 7, body, file }, res);
    return res;
};

const tempUpload = () => {
    const filePath = path.join(os.tmpdir(), `avatar-${process.pid}-${Date.now()}-${Math.random()}.png`);
    fs.writeFileSync(filePath, 'image');
    return { path: filePath, filename: path.basename(filePath) };
};

describe('updateProfile', () => {
    afterEach(() => mock.restoreAll());

    it('returns 403 for the profile of another user and removes the upload', async () => {
        const query = mockQueries();
        const file = tempUpload();

        const res = await callUpdate({ id: '8', body: VALID, file });

        assert.equal(res.statusCode, 403);
        assert.equal(query.mock.callCount(), 0);
        assert.equal(fs.existsSync(file.path), false);
    });

    const invalidBodies = [
        ['a missing body', undefined],
        ['a missing username', { bio: 'hello' }],
        ['a whitespace-only username', { username: '   ' }],
        ['a username under 3 characters', { username: 'ab' }],
        ['a username over 50 characters', { username: 'a'.repeat(51) }],
        ['a non-string username', { username: ['alice'] }],
        ['a bio over 1000 characters', { username: 'alice', bio: 'a'.repeat(1001) }],
        ['a non-string bio', { username: 'alice', bio: ['hello'] }],
        ['a password under 8 characters', { username: 'alice', password: '1234567' }],
        ['a password over 72 bytes', { username: 'alice', password: 'é'.repeat(37) }],
        ['a non-string password', { username: 'alice', password: ['password123'] }],
    ];

    for (const [label, body] of invalidBodies) {
        it(`returns 400 and writes nothing for ${label}`, async () => {
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

        await callUpdate({ body: { username: 'ab' }, file });

        assert.equal(fs.existsSync(file.path), false);
    });

    it('returns 400 when the username belongs to another user', async () => {
        const query = mockQueries([[{ id: 8 }]]);
        const file = tempUpload();

        const res = await callUpdate({ body: VALID, file });

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.message, 'Username already taken');
        assert.deepEqual(query.mock.calls[0].arguments[1], ['alice', 7]);
        assert.equal(query.mock.callCount(), 1);
        assert.equal(fs.existsSync(file.path), false);
    });

    it('updates the trimmed username and bio of the authenticated user', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);

        const res = await callUpdate({ body: { username: ' alice ', bio: ' hello ' } });

        assert.equal(res.statusCode, 200);
        const [sql, params] = query.mock.calls[1].arguments;
        assert.equal(sql, 'UPDATE users SET username = ?, bio = ? WHERE id = ?');
        assert.deepEqual(params, ['alice', 'hello', 7]);
    });

    it('accepts an empty bio', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);

        await callUpdate({ body: { username: 'alice', bio: '' } });

        assert.deepEqual(query.mock.calls[1].arguments[1], ['alice', '', 7]);
    });

    it('keeps the bio when it is not sent', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);

        await callUpdate({ body: { username: 'alice' } });

        assert.ok(!query.mock.calls[1].arguments[0].includes('bio'));
    });

    it('keeps the password when it is empty', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);

        const res = await callUpdate({ body: { ...VALID, password: '' } });

        assert.equal(res.statusCode, 200);
        assert.ok(!query.mock.calls[1].arguments[0].includes('password'));
    });

    it('stores a new password hashed', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);

        await callUpdate({ body: { ...VALID, password: 'new-password' } });

        const hash = query.mock.calls[1].arguments[1][2];
        assert.notEqual(hash, 'new-password');
        assert.ok(await bcrypt.compare('new-password', hash));
    });

    it('stores the avatar and keeps the uploaded file', async () => {
        const query = mockQueries([[]], [{ affectedRows: 1 }]);
        const file = tempUpload();

        await callUpdate({ body: VALID, file });

        assert.equal(query.mock.calls[1].arguments[1][2], `/uploads/${file.filename}`);
        assert.equal(fs.existsSync(file.path), true);
        fs.unlinkSync(file.path);
    });
});
