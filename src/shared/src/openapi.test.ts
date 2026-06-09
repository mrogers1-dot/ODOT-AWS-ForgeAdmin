import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const OPENAPI_PATH = resolve(__dirname, "../../../contracts/api/openapi.yaml");

describe("OpenAPI Specification", () => {
  it("openapi.yaml file exists", () => {
    expect(existsSync(OPENAPI_PATH)).toBe(true);
  });

  it("is valid YAML", () => {
    const content = readFileSync(OPENAPI_PATH, "utf-8");
    expect(() => parse(content)).not.toThrow();
  });

  it("has openapi version 3.1.x", () => {
    const spec = parse(readFileSync(OPENAPI_PATH, "utf-8"));
    expect(spec.openapi).toMatch(/^3\.1\./);
  });

  it("has required info section", () => {
    const spec = parse(readFileSync(OPENAPI_PATH, "utf-8"));
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBeDefined();
    expect(spec.info.version).toBeDefined();
  });

  it("defines security scheme (Cognito JWT)", () => {
    const spec = parse(readFileSync(OPENAPI_PATH, "utf-8"));
    expect(spec.components?.securitySchemes).toBeDefined();
    const schemes = Object.values(spec.components.securitySchemes) as any[];
    expect(schemes.some((s: any) => s.type === "http" || s.type === "oauth2" || s.type === "openIdConnect")).toBe(true);
  });

  it("has paths for /modules, /approvals, /executions, /audit", () => {
    const spec = parse(readFileSync(OPENAPI_PATH, "utf-8"));
    const paths = Object.keys(spec.paths || {});
    expect(paths.some((p) => p.includes("modules"))).toBe(true);
    expect(paths.some((p) => p.includes("approvals"))).toBe(true);
    expect(paths.some((p) => p.includes("executions"))).toBe(true);
    expect(paths.some((p) => p.includes("audit"))).toBe(true);
  });

  it("defines ModuleConfig schema with required constraints", () => {
    const spec = parse(readFileSync(OPENAPI_PATH, "utf-8"));
    const schemas = spec.components?.schemas;
    expect(schemas?.ModuleConfig).toBeDefined();
    const mc = schemas.ModuleConfig;
    expect(mc.properties?.confidenceThreshold).toBeDefined();
    expect(mc.properties?.promotionStrategy).toBeDefined();
  });
});
