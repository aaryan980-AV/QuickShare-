import fs from 'fs';
import path from 'path';
import { createClient } from '@vercel/kv';
import { config } from '../config.js';

class PersistentFileMemoryStorage {
  constructor() {
    this.store = new Map();
    this.filePath = path.resolve('.local_shares.json');
    this.loadFromDisk();

    // Cleanup expired keys every 60 seconds
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const [code, item] of Object.entries(parsed)) {
          if (item && item.expiresAt > now) {
            this.store.set(code, item);
          }
        }
        console.log(`[Storage] Loaded ${this.store.size} active share(s) from disk cache.`);
      }
    } catch (err) {
      console.warn('[Storage] Error loading local cache:', err.message);
    }
  }

  saveToDisk() {
    try {
      const obj = {};
      for (const [code, item] of this.store.entries()) {
        obj[code] = item;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Storage] Error saving local cache:', err.message);
    }
  }

  async saveShare(code, data, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(code, {
      data,
      expiresAt
    });
    this.saveToDisk();
    return true;
  }

  async getShare(code) {
    const item = this.store.get(code);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(code);
      this.saveToDisk();
      return null;
    }
    return item.data;
  }

  async deleteShare(code) {
    const deleted = this.store.delete(code);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  async codeExists(code) {
    const item = await this.getShare(code);
    return item !== null;
  }

  cleanup() {
    const now = Date.now();
    let changed = false;
    for (const [code, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(code);
        changed = true;
      }
    }
    if (changed) {
      this.saveToDisk();
    }
  }

  getType() {
    return 'local-persistent-storage';
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
    console.warn('[Storage] WARNING: Running on Vercel without KV_REST_API_URL/TOKEN. Memory fallback used.');
  } else {
    console.log('[Storage] Initializing Persistent Local Storage for development.');
  }
  storageInstance = new PersistentFileMemoryStorage();
}

export const storage = storageInstance;
