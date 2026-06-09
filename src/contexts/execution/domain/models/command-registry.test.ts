import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REGISTRY_DIR = resolve(__dirname, "../../../../../contracts/command-registry");
const SCHEMA_PATH = resolve(REGISTRY_DIR, "schema.json");

describe("Command Registry", () => {
  it("schema.json exists and is valid JSON Schema", () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
    const ajv = new Ajv({ strict: false });
    expect(() => ajv.compile(schema)).not.toThrow();
  });

  it("has at least 5 cmdlet definitions", () => {
    const categories = readdirSync(REGISTRY_DIR).filter(
      (f) => !f.endsWith(".json") && !f.startsWith("."),
    );
    let count = 0;
    for (const cat of categories) {
      const catDir = join(REGISTRY_DIR, cat);
      const files = readdirSync(catDir).filter((f) => f.endsWith(".json"));
      count += files.length;
    }
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("all cmdlet definitions conform to schema", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(schema);

    const categories = readdirSync(REGISTRY_DIR).filter(
      (f) => !f.endsWith(".json") && !f.startsWith("."),
    );

    const failures: string[] = [];
    for (const cat of categories) {
      const catDir = join(REGISTRY_DIR, cat);
      const files = readdirSync(catDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const content = JSON.parse(readFileSync(join(catDir, file), "utf-8"));
        if (!validate(content)) {
          failures.push(`${cat}/${file}: ${JSON.stringify(validate.errors)}`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
