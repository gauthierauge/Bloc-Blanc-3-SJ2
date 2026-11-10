const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const {
    cleanString,
    isValidUsername,
    isValidPassword,
    isValidBio,
    USERNAME_ERROR,
    PASSWORD_ERROR,
    BIO_ERROR,
} = require('../utils/validation');

const reject = async (req, res, status, message) => {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res.status(status).json({ message });
};

exports.getProfile = async (req, res) => {
    const [rows] = await pool.query(
        'SELECT id, username, bio, avatar, created_at FROM users WHERE id = ?',
        [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
};

exports.getMe = async (req, res) => {
  const [rows] = await pool.query(
      'SELECT id, username, bio, email, avatar, created_at FROM users WHERE id = ?',
      [req.userId]
  );

  if (0 === rows.length) return res.status(404).json({ message: 'Profile not found' });
  res.json(rows[0])
}

exports.updateProfile = async (req, res) => {
    if (parseInt(req.params.id) !== req.userId) {
        return reject(req, res, 403, 'Not authorized');
    }

    const username = cleanString(req.body?.username);
    const bio = req.body?.bio;
    const password = req.body?.password;

    if (!isValidUsername(username)) return reject(req, res, 400, USERNAME_ERROR);
    if (bio !== undefined && !isValidBio(bio)) return reject(req, res, 400, BIO_ERROR);
    if (password && !isValidPassword(password)) return reject(req, res, 400, PASSWORD_ERROR);

    const [taken] = await pool.query('SELECT id FROM users WHERE username = ? AND id <> ?', [username, req.userId]);
    if (taken.length > 0) return reject(req, res, 400, 'Username already taken');

    let query = 'UPDATE users SET username = ?';
    let params = [username];

    if (bio !== undefined) {
        query += ', bio = ?';
        params.push(bio.trim());
    }

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ', password = ?';
        params.push(hashedPassword);
    }

    if (req.file) {
        const avatar = `/uploads/${req.file.filename}`;
        query += ', avatar = ?';
        params.push(avatar);
    }

    query += ' WHERE id = ?';
    params.push(req.userId);

    await pool.query(query, params);
    res.json({ message: 'Profile updated successfully' });
};
