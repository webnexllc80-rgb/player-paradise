import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/players_paradise';

const options = {
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 45000,
  connectTimeoutMS: 15000,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
};

let cachedDb = null;

async function getConnectedClient() {
  if (global._mongoClientPromise) {
    try {
      const existingClient = await global._mongoClientPromise;
      if (existingClient && typeof existingClient.db === 'function') {
        return existingClient;
      }
    } catch {
      global._mongoClientPromise = null;
      cachedDb = null;
    }
  }

  const client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect().catch((err) => {
    global._mongoClientPromise = null;
    cachedDb = null;
    throw err;
  });

  const connectedClient = await global._mongoClientPromise;
  if (!connectedClient || typeof connectedClient.db !== 'function') {
    global._mongoClientPromise = null;
    cachedDb = null;
    throw new Error('Failed to establish active MongoDB connection.');
  }

  return connectedClient;
}

/**
 * Returns the active MongoDB Database instance with in-memory caching.
 * Reuses the existing connection and db instance for 0ms overhead on subsequent queries.
 */
export async function getDb() {
  if (cachedDb) return cachedDb;
  const clientInstance = await getConnectedClient();
  cachedDb = clientInstance.db();
  return cachedDb;
}

export function resetMongoConnection() {
  global._mongoClientPromise = null;
  cachedDb = null;
}

const clientPromise = {
  then: (onfulfilled, onrejected) => getConnectedClient().then(onfulfilled, onrejected),
  catch: (onrejected) => getConnectedClient().catch(onrejected),
};

export default clientPromise;
