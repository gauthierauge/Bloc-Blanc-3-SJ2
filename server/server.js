require('dotenv').config();

const express = require('express');
const path = require('path');
const { initDB } = require('./config/db');
const corsMiddleware = require('./config/cors');
const helmetMiddleware = require('./config/helmet');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const articleRoutes = require('./routes/article.routes');
const userRoutes = require('./routes/user.routes');
const commentRoutes = require('./routes/comment.routes');

const app = express();
const PORT = process.env.PORT || 5030;

// Middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB initialization
(async () => {
    await initDB();
})();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Blog API is running...');
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
