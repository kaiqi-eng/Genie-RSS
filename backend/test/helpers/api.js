export const API_KEY = process.env.API_KEY || "test-api-key-12345";

export function withApiKey(req) {
  return req.set("X-API-Key", API_KEY);
}

export function withBearer(req, token) {
  return req.set("Authorization", `Bearer ${token}`);
}
