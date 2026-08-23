import { createClient } from '@vercel/kv';
import { config } from '../config.js';

class MemoryStorageFallback {
  constructor() {
    this.store = new Map();
    // Cleanup expired keys every 60 seconds
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  async saveShare(code, data, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(code, {
      data,
      expiresAt
    });
    return true;
  }

  async getShare(code) {
    const item = this.store.get(code);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(code);
      return null;
    }
    return item.data;
  }

  async deleteShare(code) {
    return this.store.delete(code);
  }

  async codeExists(code) {
    const item = await this.getShare(code);
    return item !== null;
  }

  cleanup() {
    const now = Date.now();
    for (const [code, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(code);
      }
    }
  }

  getType() {
    return 'in-memory-fallback';
  }
}

class VercelKVStorage {
  constructor(url, token) {
    this.kv = createClient({
      url,
      token
    });
  }

  async saveShare(code, data, ttlSeconds) {
    const key = `share:${code}`;
    // Store JSON with TTL (ex in seconds)
    await this.kv.set(key, JSON.stringify(data), { ex: ttlSeconds });
    return true;
  }

  async getShare(code) {
    const key = `share:${code}`;
    const raw = await this.kv.get(key);
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  async deleteShare(code) {
    const key = `share:${code}`;
    await this.kv.del(key);
    return true;
  }

  async codeExists(code) {
    const key = `share:${code}`;
    const exists = await this.kv.exists(key);
    return exists === 1;
  }

  getType() {
    return 'vercel-kv';
  }
}

let storageInstance;

if (config.kvRestApiUrl && config.kvRestApiToken) {
  console.log('[Storage] Initializing Vercel KV persistent storage.');
  storageInstance = new VercelKVStorage(config.kvRestApiUrl, config.kvRestApiToken);
} else {
  if (config.isVercel) {
    console.warn('[Storage] WARNING: Running on Vercel without KV_REST_API_URL/TOKEN. Memory fallback used (data will not persist across function invocations).');
  } else {
    console.log('[Storage] Initializing In-Memory storage fallback for local development.');
  }
  storageInstance = new MemoryStorageFallback();
}

export const storage = storageInstance;
