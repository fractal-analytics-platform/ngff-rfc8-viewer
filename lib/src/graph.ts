import * as d3 from 'd3';
import type { D3Node, ExtraEdgesFn, OmeNode, OmePath } from './types';
import type { NGFFLoader } from './loader';

type PathD3Node = D3Node & { omeNode: OmeNode & { path: OmePath } };

export class NGFFGraph {
  private loader: NGFFLoader;
  private autoloadDepth: number;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  private hierarchy: d3.HierarchyNode<D3Node> | undefined;

  private signalLoading: (loading: boolean) => void = () => {};
  private signalError: (message: string | null) => void = () => {};
  private signalNodeUpdated: (node: D3Node) => void = () => {};
  private signalChange: () => void = () => {};

  private lastGeneratedId = 0;

  constructor(
    loader: NGFFLoader,
    autoloadDepth: number,
    computeExtraEdges: ExtraEdgesFn | undefined = undefined
  ) {
    this.loader = loader;
    this.autoloadDepth = autoloadDepth;
    this.computeExtraEdges = computeExtraEdges;
  }

  onLoading(fn: (loading: boolean) => void) {
    this.signalLoading = fn;
  }

  onError(fn: (message: string | null) => void) {
    this.signalError = fn;
  }

  reportError(message: string) {
    this.signalError(message);
  }

  onNodeUpdated(fn: (node: D3Node) => void) {
    this.signalNodeUpdated = fn;
  }

  onChange(fn: () => void) {
    this.signalChange = fn;
  }

  getHierarchy(): d3.HierarchyNode<D3Node> {
    return this.hierarchy!;
  }

  getExtraEdges() {
    return this.extraEdges;
  }

  async loadRoot(): Promise<boolean> {
    try {
      const ome = await this.loader.loadGraphData();
      await this.render(ome);
      return true;
    } catch (err) {
      this.signalError(err instanceof Error ? err.message : 'Unexpected error');
      return false;
    }
  }

  walk(
    nodes: Array<D3Node>,
    node: OmeNode & { generatedId?: string },
    parentId: string | null,
    resolvedPath: string,
    extraEdges: Array<{ sourceId: string; targetId: string }>
  ) {
    if (!('generatedId' in node) || !node.generatedId) {
      this.lastGeneratedId++;
      node.generatedId = String(this.lastGeneratedId);
    }

    nodes.push({
      id: node.generatedId,
      omeNode: this.getBasicOmeNode(node),
      parentId: parentId,
      loading: false,
      loaded: !('path' in node) || node.type === 'singlescale',
      resolvedPath,
      error: false,
      collapsed: false
    });

    if (this.computeExtraEdges) {
      this.computeExtraEdges(node, extraEdges);
    }

    if ('nodes' in node && node.nodes) {
      node.nodes.forEach((child) =>
        this.walk(nodes, child, node.generatedId!, resolvedPath, extraEdges)
      );
    }
  }

  private getBasicOmeNode(node: OmeNode): OmeNode {
    const nodeCopy = { ...node };
    if ('nodes' in nodeCopy) {
      nodeCopy.nodes = [];
    }
    if ('generatedId' in nodeCopy) {
      delete nodeCopy['generatedId'];
    }
    return nodeCopy;
  }

  async render(ome: OmeNode) {
    this.walk(this.nodes, ome, null, './', this.extraEdges);
    this.buildHierarchy();

    if (this.autoloadDepth > 0) {
      this.signalLoading(true);
      await this.recusiveLoad(this.autoloadDepth);
      this.signalLoading(false);
    }

    this.signalChange();
  }

  /** Loads a node, signalling loading state to listeners. */
  async loadNodeWithSignal(node: D3Node & { omeNode: OmeNode & { path: OmePath } }) {
    this.signalLoading(true);
    try {
      await this.loadNode(node);
    } finally {
      this.signalLoading(false);
    }
  }

  async loadNodeAtPath(path: string): Promise<D3Node> {
    const relativePath = path.startsWith('./') ? path : `./${path}`;
    const targetPath = this.resolvePath('./', relativePath);

    if (!this.hierarchy) {
      throw new Error('Cannot select a path before the graph has loaded');
    }

    while (true) {
      const descendants = this.hierarchy.descendants();
      const matchingPathNode = descendants
        .map((descendant) => descendant.data)
        .filter((node): node is PathD3Node => this.isPathNode(node))
        .find((node) => this.resolvePath(node.resolvedPath, node.omeNode.path.path) === targetPath);

      if (matchingPathNode) {
        if (matchingPathNode.error) {
          throw new Error(`Unable to load node at path "${targetPath}"`);
        }
        if (!matchingPathNode.loaded) {
          await this.loadNodeWithSignal(
            matchingPathNode as D3Node & { omeNode: OmeNode & { path: OmePath } }
          );
          if (matchingPathNode.error) {
            throw new Error(`Unable to load node at path "${targetPath}"`);
          }
        }
        this.expandAncestors(matchingPathNode);
        this.signalChange();
        return matchingPathNode;
      }

      const candidates = descendants
        .map((descendant) => descendant.data)
        .filter(
          (node): node is PathD3Node =>
            this.isPathNode(node) &&
            !node.loaded &&
            !node.error &&
            this.isStrictlyWithinContentPath(node, targetPath)
        );
      const nextNode = candidates.reduce<PathD3Node | null>((deepest, node) => {
        if (!deepest || this.getContentPath(node).length > this.getContentPath(deepest).length) {
          return node;
        }
        return deepest;
      }, null);

      if (!nextNode) {
        throw new Error(`No node found at path "${targetPath}"`);
      }

      await this.loadNodeWithSignal(nextNode);
      if (nextNode.error) {
        throw new Error(`Unable to load node at path "${targetPath}"`);
      }
    }
  }

  private isPathNode(node: D3Node): node is PathD3Node {
    return 'path' in node.omeNode && node.omeNode.path !== undefined;
  }

  private getContentPath(node: PathD3Node): string {
    const path = this.resolvePath(node.resolvedPath, node.omeNode.path.path);
    if (node.omeNode.path.type !== 'json') {
      return path;
    }
    const directory = path.substring(0, path.lastIndexOf('/'));
    return directory === '.' || directory === '' ? './' : directory;
  }

  private isStrictlyWithinContentPath(node: PathD3Node, targetPath: string): boolean {
    const contentPath = this.getContentPath(node);
    return (
      targetPath !== contentPath && targetPath.startsWith(`${contentPath.replace(/\/$/, '')}/`)
    );
  }

  private expandAncestors(node: D3Node) {
    let parentId = node.parentId;
    while (parentId !== null) {
      const parent = this.nodes.find((candidate) => candidate.id === parentId);
      if (!parent) {
        break;
      }
      parent.collapsed = false;
      parentId = parent.parentId;
    }
  }

  async recusiveLoad(autoloadDepth: number) {
    if (autoloadDepth === Infinity || autoloadDepth > 0) {
      let loaded = false;
      for (const leave of this.hierarchy!.leaves()) {
        if ('path' in leave.data.omeNode) {
          const node = leave.data as D3Node & { omeNode: OmeNode & { path: OmePath } };
          if (!node.loaded && !node.error) {
            await this.loadNode(node);
            loaded = true;
          }
        }
      }
      if (loaded) {
        await this.recusiveLoad(autoloadDepth === Infinity ? Infinity : autoloadDepth - 1);
      }
    }
  }

  buildHierarchy() {
    this.hierarchy = d3.stratify<D3Node>()(this.nodes);
  }

  async loadNode(node: D3Node & { omeNode: OmeNode & { path: OmePath } }) {
    if (node.loading || node.loaded || node.error) {
      return;
    }
    this.signalError(null);
    node.loading = true;
    try {
      switch (node.omeNode.path.type) {
        case 'json':
          {
            const resolvedPath = this.resolvePath(node.resolvedPath, node.omeNode.path.path);
            const ome = await this.loader.loadNode(resolvedPath);
            this.updateNode(node, ome);
            await this.appendSubtree(
              ome,
              resolvedPath.substring(0, resolvedPath.search(/\/[^/]+\.json$/))
            );
          }
          break;
        case 'zarr':
          {
            const ome = await this.loader.loadNode(
              this.resolvePath(node.resolvedPath, `${node.omeNode.path.path}/zarr.json`)
            );
            this.updateNode(node, ome);
            await this.appendSubtree(
              ome,
              this.resolvePath(node.resolvedPath, node.omeNode.path.path)
            );
          }
          break;
        default:
          this.signalError(`Unexpected path type: ${node.omeNode.path.type}`);
          break;
      }
    } catch (err) {
      node.loaded = false;
      node.error = true;
      console.error(err);
      this.signalError(err instanceof Error ? err.message : 'Unexpected error');
    }
    node.loading = false;
  }

  updateNode(node: D3Node, ome: OmeNode) {
    node.loaded = true;
    node.omeNode.attributes = { ...(node.omeNode.attributes || {}), ...ome.attributes };
    (ome as any).generatedId = node.id;
    this.signalNodeUpdated(node);
  }

  resolvePath(parentPath: string, path: string) {
    if (!path.startsWith('./') || path.includes('..')) {
      throw new Error(`Unsupported path "${path}"`);
    }
    parentPath = parentPath.replace(/^\.\//, '').replace(/\/$/, '');
    path = path.replace(/^\.\//, '').replace(/\/$/, '');
    return parentPath ? `./${parentPath}/${path}` : `./${path}`;
  }

  async appendSubtree(ome: OmeNode, resolvedPath: string) {
    const nodes: Array<D3Node> = [];
    const extraEdges: Array<{ sourceId: string; targetId: string }> = [];
    this.walk(nodes, ome, null, resolvedPath, extraEdges);
    if (nodes.length > 0) {
      this.nodes.push(...nodes.splice(1));
    }
    this.buildHierarchy();
  }
}
