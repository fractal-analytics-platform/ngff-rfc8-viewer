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

  if ('attributes' in node && node.attributes) {
    if (!isObject(node.attributes)) {
      throw new Error(`Invalid field at ${path || 'root'}.attributes: must be an object`);
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
    if (!('path' in node.path)) {
      throw new Error(`Invalid field at ${path || 'root'}.path: missing path field`);
    }
    if (typeof node.path.path !== 'string' || !node.path.path) {
      throw new Error(`Invalid field at ${path || 'root'}.path.path: must be a non-empty string`);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
