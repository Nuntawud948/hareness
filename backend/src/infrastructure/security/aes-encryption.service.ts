import crypto from 'crypto';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';

export class AESEncryptionService implements IEncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error('Encryption secret must not be empty.');
    }

    // Ensure key is exactly 32 bytes
    if (secretKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretKey)) {
      this.key = Buffer.from(secretKey, 'hex');
    } else {
      // Fallback: SHA-256 hash to ensure 32 bytes
      this.key = crypto.createHash('sha256').update(secretKey).digest();
    }
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const iv = crypto.randomBytes(12); // 96 bits IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Format: iv:tag:ciphertext (all in hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted ciphertext format. Expected iv:tag:data');
    }

    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encryptedData = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  mask(value: string): string {
    if (!value) return '';
    const trimmed = value.trim();

    if (trimmed.length <= 8) {
      return '****';
    }

    if (trimmed.startsWith('sk-')) {
      const suffix = trimmed.slice(-4);
      return `sk-...${suffix}`;
    }

    const prefix = trimmed.slice(0, 4);
    const suffix = trimmed.slice(-4);
    return `${prefix}...${suffix}`;
  }
}
