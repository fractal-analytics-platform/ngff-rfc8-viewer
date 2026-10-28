/**
 * Tolerance layer for the camelCase spelling still used by the upstream RFC-8 draft
 * (`extensionManifest`, `coordinateSystems`, ...). Only structural keys are renamed; extension
 * trait payloads are left untouched. The whole module can be deleted once the casing sub-RFC lands.
 */

const KEY_RENAMES: Record<string, string> = {
  extensionManifest: 'extension_manifest',
  mustUnderstand: 'must_understand',
  coordinateSystems: 'coordinate_systems',
  coordinateTransformations: 'coordinate_transformations',
  labelAttributes: 'label_attributes',
  labelValue: 'label_value',
  rowIndex: 'row_index',
  columnIndex: 'column_index'
};

const SCHEMA_TYPE_RENAMES: Record<string, string> = {
  json_schema: 'jsonschema'
};

/** Returns a copy of the `ome` payload with structural keys spelled in snake_case. */
export function normalizeDocument(ome: unknown): unknown {
  if (!isObject(ome)) {
    return ome;
  }
  const out = normalizeNode(ome) as Record<string, unknown>;
  if (Array.isArray(out.extension_manifest)) {
    out.extension_manifest = out.extension_manifest.map(normalizeManifestEntry);
  }
  return out;
}

function normalizeNode(node: unknown): unknown {
  if (!isObject(node)) {
    return node;
  }
  const out = renameKeys(node);
  if (Array.isArray(out.nodes)) {
    out.nodes = out.nodes.map(normalizeNode);
  }
  if (Array.isArray(out.traits)) {
    out.traits = out.traits.map(normalizeTrait);
  }
  if (Array.isArray(out.scales)) {
    out.scales = out.scales.map((scale) => (isObject(scale) ? renameKeys(scale) : scale));
  }
  return out;
}

function normalizeTrait(trait: unknown): unknown {
  // Extension traits (URI types) are opaque: their payload must be preserved verbatim.
  if (!isObject(trait) || typeof trait.type !== 'string' || trait.type.includes('://')) {
    return trait;
  }
  const out = renameKeys(trait);
  if (Array.isArray(out.label_attributes)) {
    out.label_attributes = out.label_attributes.map((item) =>
      isObject(item) ? renameKeys(item) : item
    );
  }
  return out;
}

function normalizeManifestEntry(entry: unknown): unknown {
  if (!isObject(entry)) {
    return entry;
  }
  const out = renameKeys(entry);
  if (Array.isArray(out.schemas)) {
    out.schemas = out.schemas.map((schema) =>
      isObject(schema) && typeof schema.type === 'string' && schema.type in SCHEMA_TYPE_RENAMES
        ? { ...schema, type: SCHEMA_TYPE_RENAMES[schema.type] }
        : schema
    );
  }
  return out;
}

function renameKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[KEY_RENAMES[key] ?? key] = value;
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
