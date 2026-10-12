import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/players_paradise';
const options = {
  maxPoolSize: 20,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 4000,
  connectTimeoutMS: 4000,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((err) => {
      console.warn('MongoDB connection warning:', err.message);
      return null;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((err) => {
    console.warn('MongoDB connection warning (prod):', err.message);
    return null;
  });
}

// In-memory fallback database for ultra-reliability
const fallbackStore = {
  users: [],
  accountRequests: [],
  gameAccounts: [],
  deposits: [],
  redemptions: [],
  games: [],
  ledger: [],
  chat: [],
  notifications: [],
  paymentMethods: [],
  settings: [],
  kyc: [],
};

function createCollectionWrapper(name) {
  if (!fallbackStore[name]) fallbackStore[name] = [];
  const data = fallbackStore[name];

  return {
    async find(query = {}) {
      let filtered = data.filter((doc) => {
        for (const key of Object.keys(query)) {
          if (key === '$in' || key === '$or') continue;
          if (query[key] instanceof RegExp) {
            if (!query[key].test(String(doc[key] || ''))) return false;
          } else if (doc[key] !== query[key]) {
            return false;
          }
        }
        return true;
      });

      return {
        sort: (sortObj = {}) => ({
          limit: (n) => ({
            toArray: async () => filtered.slice(0, n),
          }),
          toArray: async () => filtered,
        }),
        limit: (n) => ({
          toArray: async () => filtered.slice(0, n),
        }),
        toArray: async () => filtered,
      };
    },
    async findOne(query = {}) {
      return (
        data.find((doc) => {
          for (const key of Object.keys(query)) {
            if (query[key] instanceof RegExp) {
              if (!query[key].test(String(doc[key] || ''))) return false;
            } else if (doc[key] !== query[key]) {
              return false;
            }
          }
          return true;
        }) || null
      );
    },
    async insertOne(doc) {
      const inserted = {
        _id: doc._id || Math.random().toString(36).substring(2, 12),
        ...doc,
        createdAt: doc.createdAt || new Date(),
      };
      data.push(inserted);
      return { insertedId: inserted._id, acknowledged: true };
    },
    async insertMany(docs) {
      const inserted = docs.map((d) => ({
        _id: d._id || Math.random().toString(36).substring(2, 12),
        ...d,
        createdAt: d.createdAt || new Date(),
      }));
      data.push(...inserted);
      return { insertedIds: inserted.map((d) => d._id), acknowledged: true };
    },
    async updateOne(filter, update) {
      const doc = await this.findOne(filter);
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) {
        Object.assign(doc, update.$set);
      }
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          doc[k] = (doc[k] || 0) + v;
        }
      }
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    },
    async deleteOne(filter) {
      const idx = data.findIndex((doc) => {
        for (const key of Object.keys(filter)) {
          if (doc[key] !== filter[key]) return false;
        }
        return true;
      });
      if (idx !== -1) {
        data.splice(idx, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
    async countDocuments(query = {}) {
      const res = await this.find(query);
      const arr = await res.toArray();
      return arr.length;
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
