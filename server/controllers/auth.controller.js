const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
    cleanString,
    isValidUsername,
    isValidEmail,
    isValidPassword,
    USERNAME_ERROR,
    EMAIL_ERROR,
    PASSWORD_ERROR,
} = require('../utils/validation');

const parseRegistration = (body) => {
    const username = cleanString(body?.username);
    const email = cleanString(body?.email);
    const password = body?.password;

    if (!isValidUsername(username)) return { error: USERNAME_ERROR };
    if (!isValidEmail(email)) return { error: EMAIL_ERROR };
    if (!isValidPassword(password)) return { error: PASSWORD_ERROR };
    return { username, email, password };
};

exports.register = async (req, res) => {
    const { username, email, password, error } = parseRegistration(req.body);
    if (error) return res.status(400).json({ message: error });

    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length > 0) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

    res.status(201).json({ message: 'User registered successfully' });
};

exports.login = async (req, res) => {
    const email = cleanString(req.body?.email);
    const password = req.body?.password;

    if (!email || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar }
    });
};
