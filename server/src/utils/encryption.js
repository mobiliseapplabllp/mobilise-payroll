const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY 
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest() 
  : crypto.createHash('sha256').update('default-dev-key-change-in-production!').digest();
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM (authenticated encryption)
 * Returns: iv:authTag:ciphertext (hex encoded)
 */
function encrypt(text) {
  if (!text || typeof text !== 'string' || text.length < 1) return text;
  if (text.includes(':') && text.length > 40) return text; // already encrypted
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch { return text; }
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
function decrypt(text) {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(':');
  if (parts.length < 3) return text; // not encrypted
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts.slice(2).join(':');
    if (iv.length !== IV_LENGTH) return text;
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return text; }
}

/**
 * Mask a value for display (shows last N characters)
 */
function mask(text, showLast = 4) {
  if (!text || text.length <= showLast) return text || '';
  const decrypted = decrypt(text);
  if (!decrypted || decrypted.length <= showLast) return decrypted || '';
  return '●'.repeat(Math.max(decrypted.length - showLast, 4)) + decrypted.slice(-showLast);
}

/**
 * Encrypt a JSON object as a single blob
 * Used for salary components, payroll details
 */
function encryptJSON(obj) {
  if (!obj) return '';
  try {
    return encrypt(JSON.stringify(obj));
  } catch { return ''; }
}

/**
 * Decrypt a JSON blob back to object
 */
function decryptJSON(text) {
  if (!text) return null;
  try {
    const decrypted = decrypt(text);
    return JSON.parse(decrypted);
  } catch { return null; }
}

/**
 * Encrypt a number (for salary fields)
 */
function encryptNumber(num) {
  if (num === null || num === undefined) return '';
  return encrypt(String(num));
}

/**
 * Decrypt back to number
 */
function decryptNumber(text) {
  if (!text) return 0;
  const dec = decrypt(text);
  const num = parseFloat(dec);
  return isNaN(num) ? 0 : num;
}

/**
 * Hash a value for searchable index (one-way, for lookups)
 */
function hashForSearch(text) {
  if (!text) return '';
  return crypto.createHmac('sha256', KEY).update(text.toLowerCase().trim()).digest('hex').substring(0, 16);
}

module.exports = { encrypt, decrypt, mask, encryptJSON, decryptJSON, encryptNumber, decryptNumber, hashForSearch };
