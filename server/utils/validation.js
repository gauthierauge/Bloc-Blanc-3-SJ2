const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BIO_LENGTH = 1000;
const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 10000;

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const isValidId = (value) =>
  typeof value === "string" && /^[1-9]\d*$/.test(value);

const isValidUsername = (username) =>
  username.length >= 3 && username.length <= 50;

const isValidEmail = (email) =>
  email.length <= 100 && EMAIL_PATTERN.test(email);

const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  Buffer.byteLength(password) <= 72;

const isValidBio = (bio) =>
  typeof bio === "string" && bio.trim().length <= MAX_BIO_LENGTH;

const isValidTitle = (title) => title.length >= 1 && title.length <= MAX_TITLE_LENGTH;

const isValidContent = (content) => content.length >= 1  && content.length <= MAX_CONTENT_LENGTH;

const validateArticle = (body) => {
  const title = cleanString(body?.title);
  const content = cleanString(body?.content);

  if (!isValidTitle(title)) {
    return { error: TITLE_ERROR }
  }
  if (!isValidContent(content)) {
    return { error: CONTENT_ERROR}
  }

  return { title, content };
}

const USERNAME_ERROR = "Username must be between 3 and 50 characters";
const EMAIL_ERROR = "Invalid email address";
const PASSWORD_ERROR = "Password must be between 8 and 72 characters";
const BIO_ERROR = `Bio must be at most ${MAX_BIO_LENGTH} characters`;
const TITLE_ERROR = `Title must be at most ${MAX_TITLE_LENGTH} characters`;
const CONTENT_ERROR = `Content must be at most ${MAX_CONTENT_LENGTH} characters`;

module.exports = {
  cleanString,
  isValidId,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isValidBio,
  validateArticle,
  USERNAME_ERROR,
  EMAIL_ERROR,
  PASSWORD_ERROR,
  BIO_ERROR,
  TITLE_ERROR,
  CONTENT_ERROR,
};
