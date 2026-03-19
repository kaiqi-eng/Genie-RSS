import jwt from "jsonwebtoken";

export function createAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role || "user",
    permissions: user.permissions || [],
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET); 
  console.log(token);
  return token;
}