import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable');

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
    }
}

const cached = global.mongooseCache || (global.mongooseCache = { conn: null, promise: null });

export const connectToDatabase = async () => {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });  // bufferCommands: false is used to prevent mongoose from buffering commands if the connection is not established yet. This can help to avoid issues with too many connections being created during development.
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('MongoDB connection error. Please make sure MongoDB is running. ' + e);
        throw e;
    }

    console.info('Connected to MongoDB');
    return cached.conn;
}

// created an cached connection to the database to avoid multiple connections in development mode due to hot reloading.
// this is a common pattern for connecting to MongoDB in Next.js applications. It ensures that we only create a single connection to the database, even if the server is restarted multiple times during development.
// the connection to our server will destroy when the server is restarted, but the cached connection will persist, allowing us to reuse it when the server starts up again. This helps to avoid issues with too many connections being created during development.