// lib/mongodb.ts
import mongoose, { Mongoose } from "mongoose";

/**
 * Shape of the cached object stored on globalThis to avoid reconnecting
 * during development (Next.js hot reloads / serverless re-invocations).
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

/**
 * Extend globalThis with a property to cache Mongoose connection & promise.
 * Using `unknown as` cast to avoid polluting the global/NodeJS types.
 */
const globalWithMongoose = globalThis as unknown as {
  __mongoose?: MongooseCache;
};

/**
 * Ensure we have an initialized cache object on globalThis.
 * In production we don't rely on the global cache but this allows reuse in dev.
 */
if (!globalWithMongoose.__mongoose) {
  globalWithMongoose.__mongoose = { conn: null, promise: null };
}

/**
 * Connects to MongoDB using Mongoose and returns the connected Mongoose instance.
 * - Caches a pending promise to dedupe concurrent connection attempts.
 * - Caches the resolved connection on globalThis in development to prevent
 *   multiple connections when Next.js hot reloads modules.
 *
 * Usage:
 *   const mongoose = await connectToDatabase();
 *
 * Throws an error if MONGODB_URI is not provided or if connection fails.
 */
export async function connectToDatabase(): Promise<Mongoose> {
    const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local or the environment."
    );
  }

  // If connection is already established, return it immediately.
  if (globalWithMongoose.__mongoose!.conn) {
    return globalWithMongoose.__mongoose!.conn as Mongoose;
  }

  // If a connection is in progress, await it.
  if (globalWithMongoose.__mongoose!.promise) {
    globalWithMongoose.__mongoose!.conn = await globalWithMongoose.__mongoose!
      .promise;
    return globalWithMongoose.__mongoose!.conn as Mongoose;
  }

  // Create a new connection promise and store it so concurrent callers reuse it.
  const connectPromise: Promise<Mongoose> = (async () => {
    // Recommended options for Mongoose v6+:
    // Note: many options are no-ops in recent mongoose versions, but explicit is fine.
    mongoose.set("strictQuery", true);

    // `mongoose.connect` resolves with the mongoose instance after connecting.
    const m = await mongoose.connect(MONGODB_URI, {
      // The following options are kept for clarity and compatibility.
      // Mongoose v6+ uses sensible defaults, so these may be optional.
      // @ts-ignore - mongoose type signature for connect options is permissive.
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as mongoose.ConnectOptions);

    return m;
  })();

  globalWithMongoose.__mongoose!.promise = connectPromise;

  try {
    globalWithMongoose.__mongoose!.conn = await connectPromise;
    return globalWithMongoose.__mongoose!.conn as Mongoose;
  } catch (error) {
    // Clear the promise so future calls can retry connection.
    globalWithMongoose.__mongoose!.promise = null;
    throw error;
  }
}

/**
 * Export default mongoose instance for direct model usage if desired.
 * Note: `connectToDatabase()` should be awaited before using models in server code
 * (or ensure models are defined before the first request runs).
 */
export default mongoose;
