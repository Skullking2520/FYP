import { afterEach, describe, expect, it } from "vitest";
import { isAdminUser, isAdminUserEmail } from "../admin";

const originalList = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
const originalSingle = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

afterEach(() => {
  if (originalList === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  else process.env.NEXT_PUBLIC_ADMIN_EMAILS = originalList;
  if (originalSingle === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  else process.env.NEXT_PUBLIC_ADMIN_EMAIL = originalSingle;
});

describe("admin presentation", () => {
  it("has no implicit email allowlist", () => {
    delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    expect(isAdminUserEmail("person@example.com")).toBe(false);
    expect(isAdminUser({ email: "person@example.com", is_admin: false })).toBe(false);
  });
  it("normalizes explicit UI configuration", () => {
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = " Admin@example.com ";
    expect(isAdminUserEmail("ADMIN@example.com")).toBe(true);
    expect(isAdminUserEmail("person@example.com")).toBe(false);
  });
  it("retains server-provided role flags", () => {
    expect(isAdminUser({ is_admin: true })).toBe(true);
    expect(isAdminUser({ role: "admin" })).toBe(true);
  });
});
