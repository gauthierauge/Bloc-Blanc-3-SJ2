const { isValidId } = require('../utils/validation');

const validateId = (req, res, next, id) => {
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid id' });
    next();
};

module.exports = validateId;
