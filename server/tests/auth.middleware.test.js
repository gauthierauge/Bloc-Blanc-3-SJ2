const { describe, it, before, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/auth');

const SECRET = 'test-secret';

const run = (authorization) => {
    const req = { headers: authorization ? { authorization } : {} };
    const res = {
        statusCode: 200,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json() {
            return res;
        },
    };
    const next = mock.fn();
    verifyToken(req, res, next);
    return { req, res, next };
};

describe('verifyToken', () => {
    before(() => {
        process.env.JWT_SECRET = SECRET;
    });

    it('returns 403 without a token', () => {
        const { res, next } = run();

        assert.equal(res.statusCode, 403);
        assert.equal(next.mock.callCount(), 0);
    });

    it('returns 401 for a malformed token', () => {
        const { res, next } = run('Bearer not-a-token');

        assert.equal(res.statusCode, 401);
        assert.equal(next.mock.callCount(), 0);
    });

    it('returns 401 for a token signed with another secret', () => {
        const token = jwt.sign({ id: 1 }, 'other-secret');

        const { res, next } = run(`Bearer ${token}`);

        assert.equal(res.statusCode, 401);
        assert.equal(next.mock.callCount(), 0);
    });

    it('returns 401 for an expired token', () => {
        const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: -10 });

        const { res, next } = run(`Bearer ${token}`);

        assert.equal(res.statusCode, 401);
        assert.equal(next.mock.callCount(), 0);
    });

    it('sets req.userId and continues for a valid token', () => {
        const token = jwt.sign({ id: 7 }, SECRET);

        const { req, next } = run(`Bearer ${token}`);

        assert.equal(req.userId, 7);
        assert.equal(next.mock.callCount(), 1);
    });
});
