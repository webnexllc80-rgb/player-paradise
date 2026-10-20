import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/players_paradise';

const options = {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
};

let client;
let clientPromise;

// Maintain persistent singleton connection across HMR and production server workers
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

/**
 * Returns the active MongoDB Database instance strictly from MongoDB Atlas.
 * Pure native MongoDB connection - zero file-system or JSON database fallbacks.
 */
export async function getDb() {
  const clientInstance = await clientPromise;
  return clientInstance.db();
}

export default clientPromise;
