import mongoose from "mongoose";
import dns from "dns";

/**
 * Connects to MongoDB using MONGODB_URI from environment.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  // Self-healing fallback for Node.js querySrv DNS issues (common on Windows/VPNs)
  if (uri.startsWith("mongodb+srv://")) {
    const hostPart = uri.split("@")[1]?.split("/")[0]?.split("?")[0];
    if (hostPart) {
      try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${hostPart}`);
      } catch (err) {
        if (
          err.code === "ECONNREFUSED" ||
          err.code === "ENOTFOUND" ||
          err.code === "ESERVFAIL" ||
          err.code === "EREFUSED"
        ) {
          console.warn("⚠️ DNS SRV resolution failed with default resolver. Applying Google/Cloudflare DNS fallback...");
          try {
            dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);
          } catch (dnsErr) {
            console.warn("Failed to set fallback DNS servers:", dnsErr.message);
          }
        }
      }
    }
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log("MongoDB connected");
}
