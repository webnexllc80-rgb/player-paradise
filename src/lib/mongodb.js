import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/players_paradise';
const options = {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect().catch((err) => {
    console.warn('MongoDB connection warning:', err.message);
    return null;
  });
}
clientPromise = global._mongoClientPromise;

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'paradise_db.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

const defaultStore = {
  users: [],
  accountRequests: [],
  gameAccounts: [],
  deposits: [],
  redemptions: [],
  games: [],
  ledger: [],
  chat: [],
  chat_messages: [],
  notifications: [],
  paymentMethods: [],
  payment_methods: [],
  system_settings: [],
  settings: [],
  kyc: [],
  subscriptions: [],
};

// Global singleton in-memory & file-backed persistent database
let fallbackStore = global._paradiseFallbackStore || { ...defaultStore };
global._paradiseFallbackStore = fallbackStore;

function loadFallbackStore() {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        for (const k of Object.keys(defaultStore)) {
          if (Array.isArray(parsed[k])) {
            fallbackStore[k] = parsed[k];
          }
        }
      }
    }
  } catch (err) {
    console.warn('Load fallbackStore note:', err.message);
  }
}

// Initial load
loadFallbackStore();

function saveFallbackStore() {
  ensureDataDir();
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(fallbackStore, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.warn('Save fallbackStore note:', err.message);
  }
}

function matchDoc(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;

  // Handle $or
  if (Array.isArray(query.$or)) {
    const orMatches = query.$or.some((subQuery) => matchDoc(doc, subQuery));
    if (!orMatches) return false;
  }

  // Handle $and
  if (Array.isArray(query.$and)) {
    const andMatches = query.$and.every((subQuery) => matchDoc(doc, subQuery));
    if (!andMatches) return false;
  }

  for (const [key, val] of Object.entries(query)) {
    if (key === '$or' || key === '$and') continue;

    const docVal = doc[key];

    if (val instanceof RegExp) {
      if (!val.test(String(docVal || ''))) return false;
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      if (val.$regex) {
        const regex = new RegExp(val.$regex, val.$options || 'i');
        if (!regex.test(String(docVal || ''))) return false;
      }
      if (val.$ne !== undefined && docVal === val.$ne) return false;
      if (Array.isArray(val.$in) && !val.$in.includes(docVal)) return false;
      if (val.$nin && Array.isArray(val.$nin) && val.$nin.includes(docVal)) return false;
      if (val.$gt !== undefined && !(docVal > val.$gt)) return false;
      if (val.$gte !== undefined && !(docVal >= val.$gte)) return false;
      if (val.$lt !== undefined && !(docVal < val.$lt)) return false;
      if (val.$lte !== undefined && !(docVal <= val.$lte)) return false;
    } else {
      // Direct comparison with case-insensitive string fallback
      if (docVal !== val) {
        if (
          typeof docVal === 'string' &&
          typeof val === 'string' &&
          docVal.toLowerCase() === val.toLowerCase()
        ) {
          // match case-insensitively
        } else {
          return false;
        }
      }
    }
  }

  return true;
}

function createCollectionWrapper(name) {
  if (!fallbackStore[name]) fallbackStore[name] = [];

  return {
    find(query = {}) {
      loadFallbackStore();
      const data = fallbackStore[name] || [];
      let filtered = data.filter((doc) => matchDoc(doc, query));
      let limitCount = null;

      const cursor = {
        sort(sortObj = {}) {
          const [key, dir] = Object.entries(sortObj)[0] || [];
          if (key) {
            filtered = [...filtered].sort((a, b) => {
              const valA = a[key] instanceof Date ? a[key].getTime() : a[key];
              const valB = b[key] instanceof Date ? b[key].getTime() : b[key];
              if (valA < valB) return dir === 1 ? -1 : 1;
              if (valA > valB) return dir === 1 ? 1 : -1;
              return 0;
            });
          }
          return cursor;
        },
        limit(n) {
          limitCount = n;
          return cursor;
        },
        project(projection = {}) {
          if (projection && Object.keys(projection).length > 0) {
            filtered = filtered.map(doc => {
              const res = { ...doc };
              for (const [k, v] of Object.entries(projection)) {
                if (v === 0) delete res[k];
              }
              return res;
            });
          }
          return cursor;
        },
        async toArray() {
          if (limitCount !== null) {
            return filtered.slice(0, limitCount);
          }
          return filtered;
        },
      };
      return cursor;
    },
    async findOne(query = {}) {
      loadFallbackStore();
      const data = fallbackStore[name] || [];
      return data.find((doc) => matchDoc(doc, query)) || null;
    },
    async insertOne(doc) {
      if (!fallbackStore[name]) fallbackStore[name] = [];
      const data = fallbackStore[name];
      const inserted = {
        _id: doc._id || Math.random().toString(36).substring(2, 12),
        ...doc,
        createdAt: doc.createdAt || new Date(),
      };
      data.push(inserted);
      saveFallbackStore();
      return { insertedId: inserted._id, acknowledged: true };
    },
    async insertMany(docs) {
      if (!fallbackStore[name]) fallbackStore[name] = [];
      const data = fallbackStore[name];
      const inserted = docs.map((d) => ({
        _id: d._id || Math.random().toString(36).substring(2, 12),
        ...d,
        createdAt: d.createdAt || new Date(),
      }));
      data.push(...inserted);
      saveFallbackStore();
      return { insertedIds: inserted.map((d) => d._id), acknowledged: true };
    },
    async updateOne(filter, update, options = {}) {
      if (!fallbackStore[name]) fallbackStore[name] = [];
      let doc = await this.findOne(filter);
      if (!doc) {
        if (options.upsert) {
          const newDoc = {
            _id: Math.random().toString(36).substring(2, 12),
            ...(filter.key ? { key: filter.key } : filter),
            createdAt: new Date(),
          };
          if (update.$set) Object.assign(newDoc, update.$set);
          fallbackStore[name].push(newDoc);
          saveFallbackStore();
          return { matchedCount: 0, modifiedCount: 1, upsertedId: newDoc._id, acknowledged: true };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      }
      if (update.$set) {
        Object.assign(doc, update.$set);
      }
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          doc[k] = (doc[k] || 0) + v;
        }
      }
      if (update.$addToSet) {
        for (const [k, v] of Object.entries(update.$addToSet)) {
          if (!Array.isArray(doc[k])) doc[k] = [];
          if (!doc[k].includes(v)) doc[k].push(v);
        }
      }
      saveFallbackStore();
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    },
    async updateMany(filter, update) {
      if (!fallbackStore[name]) fallbackStore[name] = [];
      const docs = fallbackStore[name].filter((doc) => matchDoc(doc, filter));
      for (const doc of docs) {
        if (update.$set) Object.assign(doc, update.$set);
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            doc[k] = (doc[k] || 0) + v;
          }
        }
      }
      if (docs.length > 0) {
        saveFallbackStore();
      }
      return { matchedCount: docs.length, modifiedCount: docs.length, acknowledged: true };
    },
    async deleteOne(filter) {
      if (!fallbackStore[name]) return { deletedCount: 0 };
      const data = fallbackStore[name];
      const idx = data.findIndex((doc) => matchDoc(doc, filter));
      if (idx !== -1) {
        data.splice(idx, 1);
        saveFallbackStore();
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
    async countDocuments(query = {}) {
      loadFallbackStore();
      const data = fallbackStore[name] || [];
      const filtered = data.filter((doc) => matchDoc(doc, query));
      return filtered.length;
    },
    aggregate(pipeline = []) {
      return {
        async toArray() {
          // Simple inbox grouping implementation for chat
          const convMap = new Map();
          for (const msg of data) {
            const cid = msg.conversationId || msg.userId;
            if (!convMap.has(cid)) {
              convMap.set(cid, {
                _id: cid,
                username: msg.username,
                userId: msg.userId,
                lastMessage: msg.text,
                lastSenderRole: msg.senderRole,
                updatedAt: msg.createdAt,
                unreadCount: msg.read === false && msg.senderRole === 'player' ? 1 : 0,
              });
            } else {
              const existing = convMap.get(cid);
              if (new Date(msg.createdAt) > new Date(existing.updatedAt)) {
                existing.lastMessage = msg.text;
                existing.lastSenderRole = msg.senderRole;
                existing.updatedAt = msg.createdAt;
              }
              if (msg.read === false && msg.senderRole === 'player') {
                existing.unreadCount++;
              }
            }
          }
          return Array.from(convMap.values());
        },
      };
    },
  };
}

const fallbackDb = {
  collection(name) {
    return createCollectionWrapper(name);
  },
};

export async function getDb() {
  try {
    const conn = await clientPromise;
    if (conn && typeof conn.db === 'function') {
      return conn.db();
    }
  } catch (err) {
    console.warn('MongoDB fallback activated:', err.message);
  }
  return fallbackDb;
}

export default clientPromise;
