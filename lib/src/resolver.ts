import type { D3Node } from './types';

export class NGFFResolver {
  private source: string;
  private prefix: string;

  constructor(source: string) {
    this.source = source;
    if (!this.source.endsWith('.json')) {
      if (!this.source.endsWith('/')) {
        this.source += '/';
      }
      this.source += 'zarr.json';
    }

    this.prefix = this.getDirectory(this.source);
  }

  public getDirectory(path: string) {
    if (path.endsWith('.json')) {
      // remove json file from path
      return path.substring(0, path.search(/\/[^/]+\.json$/));
    }
    return path;
  }

  public getSource() {
    return this.source;
  }

  public getAbsoluteUrl(source: string) {
    if (source.startsWith('./')) {
      return `${this.prefix}${source.substring(1)}`;
    }
    return source;
  }

  public getRootRelativePath() {
    return '.' + this.source.replace(this.prefix, '');
  }

  public resolveNode(node: D3Node, absolute = false) {
    if ('path' in node.omeNode && node.omeNode.path) {
      if (!['zarr', 'json'].includes(node.omeNode.path.type)) {
        throw new Error(`Unexpected path type: ${node.omeNode.path.type}`);
      }

      const parentDir = this.getDirectory(node.resolvedPath);
      const resolvedPath = this.resolvePath(parentDir, node.omeNode.path.href, absolute);

      if (['zarr'].includes(node.omeNode.path.type) && !node.omeNode.path.href.endsWith('.json')) {
        return `${resolvedPath}/zarr.json`;
      }
      return resolvedPath;
    } else {
      return absolute ? this.getAbsoluteUrl(node.resolvedPath) : node.resolvedPath;
    }
  }

  public resolvePath(parentPath: string, path: string, absolute = false) {
    if (!(path.startsWith('./') || path.startsWith('http')) || path.includes('..')) {
      throw new Error(`Unsupported path "${path}"`);
    }
    if (path.startsWith('http')) {
      return path;
    }
    parentPath = parentPath.replace(/^\.\//, '').replace(/\/$/, '');
    if (parentPath === '.') {
      parentPath = '';
    }
    path = path.replace(/^\.\//, '').replace(/\/$/, '');
    if (parentPath.startsWith('http')) {
      return `${parentPath}/${path}`;
    }
    const relativePath = parentPath ? `./${parentPath}/${path}` : `./${path}`;
    if (absolute) {
      return `${this.prefix}${relativePath.substring(1)}`;
    }
    return relativePath;
  }
}
