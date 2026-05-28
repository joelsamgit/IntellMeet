import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initRedis } from "./config/redis.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { initializeSocket } from "./services/socket.service.js";

const PORT = Number(process.env.PORT || 5000);

async function bootstrap() {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    configureCloudinary();
  } else {
    console.warn("Cloudinary env vars missing — avatar/attachment uploads will fail until configured.");
  }

  await connectDB();
  await initRedis();

  const server = http.createServer(app);
  initializeSocket(server);

  server.listen(PORT, () => {
    console.log(`IntellMeet API listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
