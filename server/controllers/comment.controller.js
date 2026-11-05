const { pool } = require("../config/db");
const { isValidId } = require("../utils/validation");

const MAX_CONTENT_LENGTH = 5000;
const PAGE_SIZE = 20;

const parseContent = (body) => {
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return { error: "Content is required" };
  if (content.length > MAX_CONTENT_LENGTH)
    return { error: "Comment is too long" };
  return { content };
};

const checkCommentAccess = async (commentId, userId) => {
  const [comments] = await pool.query(
    "SELECT user_id FROM comments WHERE id = ?",
    [commentId],
  );

  if (0 === comments.length)
    return { status: 404, message: "Comment not found" };
  if (userId !== comments[0].user_id)
    return { status: 403, message: "Not authorized" };
  return null;
};

exports.getAllCommentsByArticle = async (req, res) => {
  const before = req.query?.before;
  if (before !== undefined && !isValidId(before))
    return res.status(400).json({ message: "Invalid before parameter" });

  const cursor = before ?? null;
  const [rows] = await pool.query(
    `
      SELECT comments.*, users.username, users.avatar
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE comments.article_id = ? AND (? IS NULL OR comments.id < ?)
      ORDER BY comments.id DESC
      LIMIT ?
    `,
    [req.params.id, cursor, cursor, PAGE_SIZE + 1],
  );
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM comments WHERE article_id = ?",
    [req.params.id],
  );

  res.json({
    comments: rows.slice(0, PAGE_SIZE),
    total,
    hasMore: rows.length > PAGE_SIZE,
  });
};

exports.createComment = async (req, res) => {
  const { content, error } = parseContent(req.body);
  if (error) return res.status(400).json({ message: error });

  const [articles] = await pool.query("SELECT id FROM articles WHERE id = ?", [
    req.params.id,
  ]);
  if (0 === articles.length)
    return res.status(404).json({ message: "Article not found" });

  const [result] = await pool.query(
    "INSERT INTO comments (content, article_id, user_id) VALUES (?, ?, ?)",
    [content, req.params.id, req.userId],
  );

  const [comments] = await pool.query(
    `
      SELECT comments.*, users.username, users.avatar
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE comments.id = ?
    `,
    [result.insertId],
  );

  res.status(201).json(comments[0]);
};

exports.updateCommentById = async (req, res) => {
  const { content, error } = parseContent(req.body);
  if (error) return res.status(400).json({ message: error });

  const denied = await checkCommentAccess(req.params.id, req.userId);
  if (denied) return res.status(denied.status).json({ message: denied.message });

  await pool.query("UPDATE comments SET content = ? WHERE id = ?", [
    content,
    req.params.id,
  ]);
  res.json({ message: "Comment updated successfully" });
};

exports.deleteCommentById = async (req, res) => {
  const denied = await checkCommentAccess(req.params.id, req.userId);
  if (denied) return res.status(denied.status).json({ message: denied.message });

  await pool.query("DELETE FROM comments WHERE id = ?", [req.params.id]);
  res.json({ message: "Comment deleted successfully" });
};
