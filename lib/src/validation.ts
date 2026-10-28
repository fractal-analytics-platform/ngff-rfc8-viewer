import { PATH_FORMATS } from './constants';

/**
 * Thrown when a document uses the pre-revision RFC-8 format (`attributes`, `singlescale` nodes,
 * `path.path`). Only RFC-8 revision 1 is supported.
 */
export class LegacyFormatError extends Error {
  constructor(reason: string, location: string) {
    super(
      `This document uses the pre-revision RFC-8 format (${reason} at ${location}); only RFC-8 revision 1 is supported`
    );
    this.name = 'LegacyFormatError';
  }
}

/**
 * Detects documents written in the pre-revision RFC-8 format. Only node-level keys are inspected,
 * so trait payloads containing a key named `attributes` are not affected.
 */
export function detectLegacyFormat(node: unknown, path = ''): void {
  if (!isObject(node)) {
    return;
  }
  const location = path || 'root';
  if ('attributes' in node) {
    throw new LegacyFormatError('found "attributes"', location);
  }
  if (node.type === 'singlescale') {
    throw new LegacyFormatError('found a "singlescale" node', location);
  }
  if (isObject(node.path) && 'path' in node.path && !('href' in node.path)) {
    throw new LegacyFormatError('found "path.path" instead of "path.href"', location);
  }
  if (Array.isArray(node.nodes)) {
    node.nodes.forEach((child, index) => detectLegacyFormat(child, `${location}.nodes[${index}]`));
  }
}

/**
 * Lightweight structural validation of an RFC-8 revision 1 node (not a schema validation): checks
 * the fields the viewer relies on to build the graph.
 */
export function validateRequiredOmeStructure(node: unknown, path = '', recursive = true) {
  const location = path || 'root';
  if (!isObject(node)) {
    throw new Error(`Invalid node at ${location}: must be an object, got ${typeof node}`);
  }

  requireNonEmptyString(node, 'type', location);
  requireNonEmptyString(node, 'id', location);

  if ('name' in node && node.name !== undefined && (typeof node.name !== 'string' || !node.name)) {
    throw new Error(`Invalid field at ${location}.name: must be a non-empty string or undefined`);
  }

  if ('traits' in node && node.traits !== undefined) {
    if (!Array.isArray(node.traits)) {
      throw new Error(`Invalid field at ${location}.traits: must be an array`);
    }
    node.traits.forEach((trait, index) => {
      const traitLocation = `${location}.traits[${index}]`;
      if (!isObject(trait)) {
        throw new Error(`Invalid trait at ${traitLocation}: must be an object`);
      }
      requireNonEmptyString(trait, 'type', traitLocation);
    });
  }

  const hasChildren = 'nodes' in node && Array.isArray(node.nodes) && node.nodes.length > 0;

  if ('nodes' in node) {
    if (!Array.isArray(node.nodes)) {
      throw new Error(`Invalid field at ${location}.nodes: must be an array`);
    }
    if (node.type === 'multiscale' && node.nodes.length > 0) {
      throw new Error(
        `Invalid field at ${location}.nodes: multiscale nodes cannot have child nodes`
      );
    }
    if (recursive) {
      node.nodes.forEach((childNode, index) => {
        validateRequiredOmeStructure(childNode, `${location}.nodes[${index}]`, recursive);
      });
    }
  }

  if (hasChildren && 'path' in node) {
    throw new Error(
      `Invalid field at ${location}: found both nodes and path fields, but only one must be present`
    );
  }

  if ('path' in node) {
    validatePath(node.path, `${location}.path`);
  } else if (node.type === 'multiscale') {
    validateMultiscaleFields(node, location);
  }

  if ('extension_manifest' in node && node.extension_manifest !== undefined) {
    validateExtensionManifest(node.extension_manifest, `${location}.extension_manifest`);
  }
}

function validatePath(value: unknown, location: string) {
  if (!isObject(value)) {
    throw new Error(`Invalid field at ${location}: must be an object`);
  }
  requireNonEmptyString(value, 'type', location);
  requireNonEmptyString(value, 'format', location);
  if (!(PATH_FORMATS as readonly string[]).includes(value.format as string)) {
    throw new Error(
      `Invalid field at ${location}.format: must be one of ${PATH_FORMATS.join(', ')}, got "${value.format}"`
    );
  }
  requireNonEmptyString(value, 'href', location);
}

function validateMultiscaleFields(node: Record<string, unknown>, location: string) {
  if (!Array.isArray(node.coordinate_systems)) {
    throw new Error(`Invalid field at ${location}.coordinate_systems: must be an array`);
  }
  node.coordinate_systems.forEach((cs, index) => {
    const csLocation = `${location}.coordinate_systems[${index}]`;
    if (!isObject(cs)) {
      throw new Error(`Invalid coordinate system at ${csLocation}: must be an object`);
    }
    requireNonEmptyString(cs, 'id', csLocation);
    if (!Array.isArray(cs.axes)) {
      throw new Error(`Invalid field at ${csLocation}.axes: must be an array`);
    }
  });
  if (!Array.isArray(node.scales)) {
    throw new Error(`Invalid field at ${location}.scales: must be an array`);
  }
  node.scales.forEach((scale, index) => {
    const scaleLocation = `${location}.scales[${index}]`;
    if (!isObject(scale)) {
      throw new Error(`Invalid scale at ${scaleLocation}: must be an object`);
    }
    requireNonEmptyString(scale, 'id', scaleLocation);
    validatePath(scale.path, `${scaleLocation}.path`);
    if (!Array.isArray(scale.coordinate_transformations)) {
      throw new Error(
        `Invalid field at ${scaleLocation}.coordinate_transformations: must be an array`
      );
    }
  });
}

function validateExtensionManifest(value: unknown, location: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid field at ${location}: must be an array`);
  }
  value.forEach((entry, index) => {
    const entryLocation = `${location}[${index}]`;
    if (!isObject(entry)) {
      throw new Error(`Invalid manifest entry at ${entryLocation}: must be an object`);
    }
    requireNonEmptyString(entry, 'id', entryLocation);
    requireNonEmptyString(entry, 'version', entryLocation);
    if (!Array.isArray(entry.schemas)) {
      throw new Error(`Invalid field at ${entryLocation}.schemas: must be an array`);
    }
  });
}

function requireNonEmptyString(obj: Record<string, unknown>, key: string, location: string) {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid field at ${location}.${key}: must be a non-empty string`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
