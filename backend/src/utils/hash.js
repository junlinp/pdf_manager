import crypto from 'crypto';

/**
 * Compute SHA-256 hash of buffer as hex string (for duplicate detection).
 * @param {Buffer} buffer
 * @returns {string}
 */
export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
