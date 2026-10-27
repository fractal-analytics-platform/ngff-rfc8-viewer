import type { ExtensionManifestEntry, OmeNode, OmePath, Trait } from './types';
import { isDocumentPathType } from './paths';

/** Node keys defined by RFC-8 itself; anything else is a type-specific field. */
export const NODE_RESERVED_KEYS = [
  'type',
  'id',
  'name',
  'traits',
  'nodes',
  'path',
  'coordinate_systems',
  'scales'
];

/** Extension node/trait/path types are URIs; built-in types are keywords. */
export function isExtensionType(type: string): boolean {
  return type.includes('://');
}

/** True when the node points to another RFC-8 document (zarr group or json file). */
export function hasDocumentPath(node: OmeNode): node is OmeNode & { path: OmePath } {
  return node.path !== undefined && isDocumentPathType(node.path.type);
}

/** Human-readable label: the optional name, or the first characters of the UUID. */
export function displayName(node: OmeNode): string {
  return node.name ?? node.id.slice(0, 8);
}

/**
 * The manifest entry covering a URI type: the entry whose `id` is the longest prefix of the type.
 */
export function findManifestEntry(
  type: string,
  entries: ExtensionManifestEntry[] | undefined
): ExtensionManifestEntry | undefined {
  let best: ExtensionManifestEntry | undefined;
  for (const entry of entries ?? []) {
    if (
      (type === entry.id || type.startsWith(entry.id)) &&
      (!best || entry.id.length > best.id.length)
    ) {
      best = entry;
    }
  }
  return best;
}

/**
 * Short label for a type: keywords are returned as-is; for URI types the part after the manifest
 * entry id (or the last path segment) is used.
 */
export function shortTypeName(type: string, manifest?: ExtensionManifestEntry[]): string {
  if (!isExtensionType(type)) {
    return type;
  }
  const entry = findManifestEntry(type, manifest);
  let local =
    entry && type.length > entry.id.length
      ? type.slice(entry.id.length)
      : (type.replace(/\/+$/, '').split('/').pop() ?? type);
  local = local.replace(/^\/+|\/+$/g, '');
  return local || type;
}

export function getTrait<T extends Trait = Trait>(node: OmeNode, type: string): T | undefined {
  return node.traits?.find((trait) => trait.type === type) as T | undefined;
}

/**
 * Combines the traits of a fetched document (`base`) with the traits of the node that declares it
 * in a collection (`override`): same-type traits from the declaring node win; base order is kept and
 * override-only traits are appended.
 */
export function mergeTraits(base: Trait[] = [], override: Trait[] = []): Trait[] {
  const merged = base.map((trait) => override.find((o) => o.type === trait.type) ?? trait);
  for (const trait of override) {
    if (!base.some((b) => b.type === trait.type)) {
      merged.push(trait);
    }
  }
  return merged;
}

/** Type-specific fields of a node (everything that is not a reserved RFC-8 key). */
export function nodeFields(node: OmeNode): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!NODE_RESERVED_KEYS.includes(key)) {
      fields[key] = value;
    }
  }
  return fields;
}
