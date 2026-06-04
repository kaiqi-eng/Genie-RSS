/**
 * Accepts either:
 * - a tenantId string
 * - a user object containing tenantId
 */
export function getTenantContext(userOrTenant) {
  const tenantId =
    typeof userOrTenant === "string"
      ? userOrTenant
      : userOrTenant?.tenantId;

  if (!tenantId) {
    throw new Error("Missing tenantId for tenant context");
  }

  return {
    tenantId,
  };
}