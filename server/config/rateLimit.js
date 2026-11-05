const { rateLimit } = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many login attempts, please try again later' },
});

const commentLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (req) => String(req.userId),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many comments, please try again later' },
});

module.exports = { loginLimiter, commentLimiter };
