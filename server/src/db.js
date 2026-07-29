// MongoDB connection via mongoose.
// mongoose = an ODM (Object Document Mapper): we define document shapes as
// "models" (see src/models/) and get clean methods like Resume.create(...)
// instead of writing raw database commands.

import mongoose from "mongoose";

export async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in server/.env");
  await mongoose.connect(uri); // e.g. mongodb://localhost:27017/careerpilot
  console.log("✅ MongoDB connected");
}

// Used by /api/health — readyState 1 means "connected".
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
