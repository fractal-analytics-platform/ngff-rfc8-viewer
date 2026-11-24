export function validateRequiredOmeStructure(node: unknown, path = '', recursive = true) {
  if (!isObject(node)) {
    throw new Error(`Invalid node at ${path || 'root'}: must be an object, got ${typeof node}`);
  }

  if (typeof node.type !== 'string' || node.type.trim() === '') {
    throw new Error(`Invalid field at ${path || 'root'}.type: must be a non-empty string`);
  }

  if (typeof node.name !== 'string' || node.name.trim() === '') {
    throw new Error(`Invalid field at ${path || 'root'}.name: must be a non-empty string`);
  }

  if ('id' in node && (typeof node.id !== 'string' || node.id.trim() === '')) {
    throw new Error(`Invalid field at ${path || 'root'}.id: must be a string or undefined`);
  }

  if ('coordinateTransformations' in node && node.coordinateTransformations) {
    if (!Array.isArray(node.coordinateTransformations)) {
      throw new Error(
        `Invalid field at ${path || 'root'}.coordinateTransformations: must be an array`
      );
    }
  }

  if ('coordinateSystems' in node && node.coordinateSystems) {
    if (!Array.isArray(node.coordinateSystems)) {
      throw new Error(`Invalid field at ${path || 'root'}.coordinateSystems: must be an array`);
    }
  }

  if ('nodes' in node) {
    if (!Array.isArray(node.nodes)) {
      throw new Error(`Invalid field at ${path || 'root'}.nodes: must be an array`);
    }
    if (recursive) {
      node.nodes.forEach((childNode, index) => {
        const childPath = `${path || 'root'}.nodes[${index}]`;
        validateRequiredOmeStructure(childNode, childPath, recursive);
      });
    }
  }

  if ('nodes' in node && 'path' in node) {
    throw new Error(
      `Invalid field at ${path || 'root'}: found both nodes and path fields, but only one must be present`
    );
  }

  if ('path' in node) {
    if (!isObject(node.path)) {
      throw new Error(`Invalid field at ${path || 'root'}.path: must be an object`);
    }
    if (!('type' in node.path)) {
      throw new Error(`Invalid field at ${path || 'root'}.path: missing type field`);
    }
    if (typeof node.path.type !== 'string' || !node.path.type) {
      throw new Error(`Invalid field at ${path || 'root'}.path.type: must be a non-empty string`);
    }
    if (!('href' in node.path)) {
      throw new Error(`Invalid field at ${path || 'root'}.path: missing href field`);
    }
    if (typeof node.path.href !== 'string' || !node.path.href) {
      throw new Error(`Invalid field at ${path || 'root'}.path.href: must be a non-empty string`);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
