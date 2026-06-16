import axios from "axios";

/** Prefer VITE_API_URL; otherwise match the page hostname so localhost vs 127.0.0.1 stays consistent with CORS/cookies. */
export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, "");
  
  if (typeof window !== "undefined" && window.location?.hostname) {
    const hn = window.location.hostname;
    if (hn === "localhost" || hn === "127.0.0.1" || hn.startsWith("192.168.")) {
      return `${window.location.protocol}//${hn}:5000/api`;
    }
  }
  // Default production backend fallback
  return "https://intellmeet-ns5d.onrender.com/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

// Automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;