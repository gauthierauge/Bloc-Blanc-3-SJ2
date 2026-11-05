const { describe, it, before, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { login } = require('../controllers/auth.controller');

const callLogin = async (body) => {
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
    await login({ body }, res);
    return res;
};

describe('login', () => {
    let user;

    before(async () => {
        process.env.JWT_SECRET = 'test-secret';
        user = {
            id: 7,
            username: 'alice',
            email: 'alice@test.com',
            avatar: null,
            password: await bcrypt.hash('password123', 4),
        };
    });

    afterEach(() => mock.restoreAll());

    const invalidBodies = [
        ['a missing body', undefined],
        ['a missing email', { password: 'password123' }],
        ['a whitespace-only email', { email: '   ', password: 'password123' }],
        ['a non-string email', { email: { $ne: '' }, password: 'password123' }],
        ['a missing password', { email: 'alice@test.com' }],
        ['an empty password', { email: 'alice@test.com', password: '' }],
        ['a non-string password', { email: 'alice@test.com', password: 12345678 }],
    ];

    for (const [label, body] of invalidBodies) {
        it(`returns 400 and queries nothing for ${label}`, async () => {
            const query = mock.method(pool, 'query', async () => [[user]]);

            const res = await callLogin(body);

            assert.equal(res.statusCode, 400);
            assert.equal(query.mock.callCount(), 0);
        });
    }

    it('returns 401 for an unknown email', async () => {
        mock.method(pool, 'query', async () => [[]]);

        const res = await callLogin({ email: 'nobody@test.com', password: 'password123' });

        assert.equal(res.statusCode, 401);
    });

    it('returns 401 for a wrong password', async () => {
        mock.method(pool, 'query', async () => [[user]]);

        const res = await callLogin({ email: user.email, password: 'wrong-password' });

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.token, undefined);
    });

    it('returns a valid token and never the password hash', async () => {
        mock.method(pool, 'query', async () => [[user]]);

        const res = await callLogin({ email: ` ${user.email} `, password: 'password123' });

        assert.equal(res.statusCode, 200);
        assert.equal(jwt.verify(res.body.token, 'test-secret').id, 7);
        assert.equal(res.body.user.password, undefined);
    });

    it('accepts an old account whose password is under the new minimum', async () => {
        const oldUser = { ...user, password: await bcrypt.hash('short', 4) };
        mock.method(pool, 'query', async () => [[oldUser]]);

        const res = await callLogin({ email: user.email, password: 'short' });

        assert.equal(res.statusCode, 200);
    });
});
