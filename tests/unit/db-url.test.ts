import { describe, expect, it } from "vitest";
import { databaseEnvNames, databaseUrl, directDatabaseUrl } from "@/server/db-url";

const pg = (h: string) => `postgres://u:p@${h}/db`;

describe("database url discovery", () => {
  it("prefers the standard names", () => {
    expect(databaseUrl({ DATABASE_URL: pg("a"), POSTGRES_URL: pg("b") })).toBe(pg("a"));
    expect(databaseUrl({ POSTGRES_URL: pg("b") })).toBe(pg("b"));
  });
  it("finds prefixed integration variables and ignores test databases", () => {
    expect(databaseUrl({ TEST_DATABASE_URL: pg("t"), PLASSA_DATABASE_URL: pg("p") })).toBe(pg("p"));
    expect(databaseUrl({ STORAGE_URL: pg("s"), STORAGE_URL_UNPOOLED: pg("d") })).toBe(pg("s"));
    expect(databaseUrl({ TEST_DATABASE_URL: pg("t") })).toBeUndefined();
    expect(databaseUrl({ OTHER_URL: "https://example.test" })).toBeUndefined();
  });
  it("uses the direct connection for migrations when there is one", () => {
    expect(directDatabaseUrl({ DATABASE_URL: pg("pool"), DATABASE_URL_UNPOOLED: pg("direct") })).toBe(pg("direct"));
    expect(directDatabaseUrl({ STORAGE_URL: pg("pool"), STORAGE_URL_UNPOOLED: pg("direct") })).toBe(pg("direct"));
    expect(directDatabaseUrl({ DATABASE_URL: pg("pool") })).toBe(pg("pool"));
  });
  it("reports names, never values", () => {
    expect(databaseEnvNames({ PGHOST: "h", HOME: "/x", STORAGE_URL: pg("s") })).toEqual(["PGHOST", "STORAGE_URL"]);
  });
});
