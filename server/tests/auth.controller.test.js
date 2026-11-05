const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { register } = require('../controllers/auth.controller');

const VALID = { username: 'alice', email: 'alice@test.com', password: 'password123' };

const mockQueries = (...results) => {
    const queue = [...results];
    return mock.method(pool, 'query', async () => queue.shift());
};

const callRegister = async (body) => {
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
    await register({ body }, res);
    return res;
};

describe('register', () => {
    afterEach(() => mock.restoreAll());

    const invalidBodies = [
        ['a missing body', undefined],
        ['a missing username', { ...VALID, username: undefined }],
        ['a whitespace-only username', { ...VALID, username: '   ' }],
        ['a username under 3 characters', { ...VALID, username: 'ab' }],
        ['a username over 50 characters', { ...VALID, username: 'a'.repeat(51) }],
        ['a non-string username', { ...VALID, username: { $ne: '' } }],
        ['a missing email', { ...VALID, email: undefined }],
        ['an email without @', { ...VALID, email: 'alice.test.com' }],
        ['an email without a domain', { ...VALID, email: 'alice@test' }],
        ['an email with spaces', { ...VALID, email: 'ali ce@test.com' }],
        ['an email over 100 characters', { ...VALID, email: `${'a'.repeat(95)}@test.com` }],
        ['a non-string email', { ...VALID, email: ['alice@test.com'] }],
        ['a missing password', { ...VALID, password: undefined }],
        ['a password under 8 characters', { ...VALID, password: '1234567' }],
        ['a password over 72 bytes', { ...VALID, password: 'é'.repeat(37) }],
        ['a non-string password', { ...VALID, password: 12345678 }],
    ];

    for (const [label, body] of invalidBodies) {
        it(`returns 400 and queries nothing for ${label}`, async () => {
            const query = mockQueries();

            const res = await callRegister(body);

            assert.equal(res.statusCode, 400);
            assert.ok(res.body.message);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('returns 400 when the email or the username is already used', async () => {
        const query = mockQueries([[{ id: 1 }]]);

        const res = await callRegister(VALID);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.message, 'User already exists');
        assert.deepEqual(query.mock.calls[0].arguments[1], [VALID.email, VALID.username]);
        assert.equal(query.mock.callCount(), 1);
    });

    it('creates the user with trimmed fields and a hashed password', async () => {
        const query = mockQueries([[]], [{ insertId: 1 }]);

        const res = await callRegister({ ...VALID, username: ' alice ', email: ' alice@test.com ' });

        assert.equal(res.statusCode, 201);
        const [username, email, hash] = query.mock.calls[1].arguments[1];
        assert.equal(username, 'alice');
        assert.equal(email, 'alice@test.com');
        assert.notEqual(hash, VALID.password);
        assert.ok(await bcrypt.compare(VALID.password, hash));
    });

    it('does not trim the password', async () => {
        const query = mockQueries([[]], [{ insertId: 1 }]);

        await callRegister({ ...VALID, password: ' spaces inside ' });

        assert.ok(await bcrypt.compare(' spaces inside ', query.mock.calls[1].arguments[1][2]));
    });

    it('accepts the limit values', async () => {
        mockQueries([[]], [{ insertId: 1 }]);

        const res = await callRegister({
            username: 'abc',
            email: `${'a'.repeat(91)}@test.com`,
            password: 'a'.repeat(72),
        });

        assert.equal(res.statusCode, 201);
    });

    it('forwards a query failure to the error handler', async () => {
        mock.method(pool, 'query', async () => {
            throw new Error('db down');
        });

        await assert.rejects(callRegister(VALID), /db down/);
    });
});
