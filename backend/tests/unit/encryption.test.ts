import { describe, expect, it } from 'vitest';
import { AESEncryptionService } from '../../src/infrastructure/security/aes-encryption.service.js';

describe('AESEncryptionService', () => {
  const secretKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const service = new AESEncryptionService(secretKey);

  it('should encrypt and decrypt a plaintext string correctly', () => {
    const originalText = 'sk-proj-super-secret-openai-api-key-12345';
    const encrypted = service.encrypt(originalText);

    expect(encrypted).not.toBe(originalText);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('should fail decryption when ciphertext is tampered with', () => {
    const originalText = 'secret-token';
    const encrypted = service.encrypt(originalText);
    const parts = encrypted.split(':');
    // Corrupt ciphertext
    parts[2] = parts[2].slice(0, -2) + 'aa';
    const corrupted = parts.join(':');

    expect(() => service.decrypt(corrupted)).toThrow();
  });

  it('should mask API keys properly', () => {
    expect(service.mask('sk-proj1234567890abcdef')).toBe('sk-...cdef');
    expect(service.mask('mycustomapikey9999')).toBe('mycu...9999');
    expect(service.mask('short')).toBe('****');
    expect(service.mask('')).toBe('');
  });
});
