/**
 * JSON Schema contract validator for ForgeAdmin events.
 *
 * Validates events against their registered schemas before publishing.
 */

import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const CONTRACTS_DIR = resolve(__dirname, "../../../contracts/events");

// Singleton Ajv instance
let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({ strict: false, allErrors: true });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

// Schema cache
const schemaCache = new Map<string, object>();

function loadSchema(schemaPath: string): object {
  if (schemaCache.has(schemaPath)) {
    return schemaCache.get(schemaPath)!;
  }

  const fullPath = resolve(CONTRACTS_DIR, `${schemaPath}.schema.json`);

  try {
    const content = readFileSync(fullPath, "utf-8");
    const schema = JSON.parse(content);
    schemaCache.set(schemaPath, schema);
    return schema;
  } catch (error) {
    throw new Error(
      `Schema not found: ${schemaPath} (looked at ${fullPath})`,
    );
  }
}

function formatErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];

  return errors.map((err) => ({
    path: err.instancePath || "/",
    message: err.message || "Unknown validation error",
  }));
}

/**
 * Validates an event payload against its registered JSON Schema contract.
 *
 * @param schemaPath - Relative path within contracts/events/ (without .schema.json extension)
 *                     e.g., "ingestion/work-item.created"
 * @param event - The event object to validate
 * @returns ValidationResult with valid flag and any errors
 * @throws Error if the schema file doesn't exist
 */
export function validateEvent(schemaPath: string, event: unknown): ValidationResult {
  const schema = loadSchema(schemaPath);
  const ajv = getAjv();
  const validate = ajv.compile(schema);
  const valid = validate(event);

  return {
    valid: valid as boolean,
    errors: valid ? [] : formatErrors(validate.errors),
  };
}
