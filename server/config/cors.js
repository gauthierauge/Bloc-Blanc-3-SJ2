const cors = require('cors');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

module.exports = cors({ origin: allowedOrigins });
