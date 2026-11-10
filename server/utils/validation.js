const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BIO_LENGTH = 1000;

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

const USERNAME_ERROR = "Username must be between 3 and 50 characters";
const EMAIL_ERROR = "Invalid email address";
const PASSWORD_ERROR = "Password must be between 8 and 72 characters";
const BIO_ERROR = `Bio must be at most ${MAX_BIO_LENGTH} characters`;

module.exports = {
  cleanString,
  isValidId,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isValidBio,
  USERNAME_ERROR,
  EMAIL_ERROR,
  PASSWORD_ERROR,
  BIO_ERROR,
};
