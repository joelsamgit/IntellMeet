import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/**
 * CLIENT_URL may be comma-separated, e.g. "http://localhost:5173,http://127.0.0.1:5173"
 * so Vite opened via localhost or 127.0.0.1 both work with credentials.
 */
function parseAllowedOrigins() {
  const raw =
    process.env.CLIENT_URL || "http://localhost:5173,http://127.0.0.1:5173";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function isDevLocalOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    const hostOk =
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.startsWith("192.168.") ||
      u.hostname.startsWith("10.") ||
      u.hostname.startsWith("172.");
    return hostOk && (u.protocol === "http:" || u.protocol === "https:");
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      const allowed = parseAllowedOrigins();
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      if (isDevLocalOrigin(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
