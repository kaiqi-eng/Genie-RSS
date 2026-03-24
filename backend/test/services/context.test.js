import { describe, it, expect } from "@jest/globals";
import { getTenantContext } from "../../src/services/context.js";

describe("Context Service", () => {
  it("builds context from tenantId string", () => {
    expect(getTenantContext("tenant_abc")).toEqual({ tenantId: "tenant_abc" });
  });

  it("builds context from user object", () => {
    expect(getTenantContext({ id: "usr_1", tenantId: "tenant_xyz" })).toEqual({
      tenantId: "tenant_xyz",
    });
  });

  it("throws when tenantId is missing", () => {
    expect(() => getTenantContext({ id: "usr_1" })).toThrow(
      "Missing tenantId for tenant context"
    );
  });
});
