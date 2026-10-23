
const mongoose = require("mongoose");

let connectionPromise = null;

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return {
      status: "not_configured",
      message: "MONGODB_URI is not configured"
    };
  }

  if (mongoose.connection.readyState === 1) {
    return { status: "connected" };
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000
      })
      .then(() => ({ status: "connected" }))
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
}

async function getDatabaseStatus() {
  if (!process.env.MONGODB_URI) return "not_configured";

  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  return states[mongoose.connection.readyState] || "unknown";
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = {
  connectDatabase,
  getDatabaseStatus,
  disconnectDatabase
};
