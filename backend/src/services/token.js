import jwt from "jsonwebtoken";

export function createAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role || "user",
    permissions: user.permissions || [],
  };

  console.log(
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  })
);
}