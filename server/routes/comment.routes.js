const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const verifyToken = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const { commentLimiter } = require('../config/rateLimit');

router.param('id', validateId);

router.get('/articles/:id', commentController.getAllCommentsByArticle);
router.post('/articles/:id', verifyToken, commentLimiter, commentController.createComment);
router.put('/:id', verifyToken, commentController.updateCommentById);
router.delete('/:id', verifyToken, commentController.deleteCommentById);

module.exports = router;
