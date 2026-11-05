const multer = require('multer');

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
    }

    if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ message: err.message });
    }

    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
};

module.exports = errorHandler;
