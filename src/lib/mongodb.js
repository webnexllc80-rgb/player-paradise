import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/players_paradise';

const options = {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
};

async function getConnectedClient() {
  // Check if existing global promise is valid and resolves to a real client with .db()
  if (global._mongoClientPromise) {
    try {
      const existingClient = await global._mongoClientPromise;
      if (existingClient && typeof existingClient.db === 'function') {
        return existingClient;
      }
    } catch {
      global._mongoClientPromise = null;
    }
  }

  // Reset and create fresh connection
  global._mongoClientPromise = null;
  const client = new MongoClient(uri, options);
  
  global._mongoClientPromise = client.connect().catch((err) => {
    global._mongoClientPromise = null;
    throw err;
  });

  const connectedClient = await global._mongoClientPromise;
  if (!connectedClient || typeof connectedClient.db !== 'function') {
    global._mongoClientPromise = null;
    throw new Error('Failed to establish active MongoDB connection.');
  }

  return connectedClient;
}

/**
 * Returns the active MongoDB Database instance strictly from MongoDB Atlas.
 * Pure native MongoDB connection - zero file-system or JSON database fallbacks.
 */
export async function getDb() {
  const clientInstance = await getConnectedClient();
  return clientInstance.db();
}

const clientPromise = getConnectedClient();
export default clientPromise;
