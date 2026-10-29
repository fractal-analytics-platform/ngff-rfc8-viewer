import * as d3 from 'd3';
import type { D3Node, ExtraEdgesFn, OmeNode, OmePath } from './types';
import { UntrustedDomainError, type NGFFLoader } from './loader';

type Unsubscribe = () => void;

export class NGFFGraph {
  private loader: NGFFLoader;
  private autoloadDepth: number;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  private hierarchy: d3.HierarchyNode<D3Node> | undefined;
  private validation: boolean = false;

  private eventListeners = {
    loading: [] as Array<(loading: boolean) => void>,
    error: [] as Array<(message: string | null) => void>,
    nodeUpdated: [] as Array<(node: D3Node) => void>,
    nodeSelected: [] as Array<(node?: D3Node) => void>,
    change: [] as Array<() => void>
  };

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

  // adds fn to the list and returns a function that removes it again
  private addListener<T extends (...args: any[]) => void>(list: T[], fn: T): Unsubscribe {
    list.push(fn);
    return () => {
      const index = list.indexOf(fn);
      if (index !== -1) list.splice(index, 1);
    };
  }

  getLoader() {
    return this.loader;
  }

  // When a node is loaded
  signalLoading(loading: boolean) {
    this.eventListeners['loading'].forEach((fn) => fn(loading));
  }
  // handled by control (spinner) and sidebar (update thumbnail)
  addLoadingListener(fn: (loading: boolean) => void): Unsubscribe {
    return this.addListener(this.eventListeners['loading'], fn);
  }

  // called when loading fails
  signalError(message: string | null) {
    console.trace(message); // to enable debugging of where the error originated
    this.eventListeners['error'].forEach((fn) => fn(message));
  }
  // handled by viewer showing an error
  addErrorListener(fn: (message: string | null) => void): Unsubscribe {
    return this.addListener(this.eventListeners['error'], fn);
  }

  // When a node is loaded and extra attributes are added
  signalNodeUpdated(node: D3Node) {
    this.eventListeners['nodeUpdated'].forEach((fn) => fn(node));
  }
  // handled by sidebar.showInfo()
  addNodeUpdatedListener(fn: (node: D3Node) => void): Unsubscribe {
    return this.addListener(this.eventListeners['nodeUpdated'], fn);
  }

  // When a node is selected
  signalNodeSelected(node?: D3Node) {
    this.eventListeners['nodeSelected'].forEach((fn) => fn(node));
  }
  // handled by sidebar.showInfo()
  addNodeSelectedListener(fn: (node?: D3Node) => void): Unsubscribe {
    return this.addListener(this.eventListeners['nodeSelected'], fn);
  }

  // only called by loadRoot() -> render() and recursive load
  signalChange() {
    this.eventListeners['change'].forEach((fn) => fn());
  }
  // views.renderTree()
  addChangeListener(fn: () => void): Unsubscribe {
    return this.addListener(this.eventListeners['change'], fn);
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

  selectNode(node?: D3Node) {
    // clear selected state of all nodes
    this.nodes.forEach((n) => (n.selected = false));
    if (node) {
      node.selected = true;
    }
    this.signalNodeSelected(node);
  }

  getSelectedNode(): D3Node | undefined {
    return this.nodes.find((n) => n.selected);
  }

  setValidation(validate: boolean) {
    if (validate == this.validation) {
      return;
    }
    this.validation = validate;
    const selectedNode = this.getSelectedNode();
    if (selectedNode) {
      // trigger sidebar.showInfo()
      this.signalNodeUpdated(selectedNode);
    }
  }
  getValidation(): boolean {
    return this.validation;
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
      loaded: !('path' in node),
      resolvedPath,
      error: false,
      collapsed: false,
      selected: false
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
      await this.recursiveLoad(this.autoloadDepth);
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

  getNodeId(node: D3Node): string {
    return node.omeNode.id || node.omeNode?.name;
  }

  getChildren(node: D3Node): Array<D3Node> {
    return this.nodes.filter((n) => n.parentId === node.id);
  }

  getParentsIds(node: D3Node): Array<string> {
    const parents: Array<string> = [];
    parents.push(this.getNodeId(node));
    let current = node;
    while (current.parentId) {
      const parent = this.nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      parents.push(this.getNodeId(parent));
      current = parent;
    }
    return parents.reverse();
  }

  // path is a hierarchy of node IDs, e.g. "root/child/grandchild"
  async loadNodeAtPath(targetPath: string): Promise<D3Node> {
    if (!this.hierarchy) {
      throw new Error('Cannot select a path before the graph has loaded');
    }

    const parentIds = targetPath.split('/');
    let currentNode: D3Node | null = null;
    currentNode = this.nodes.find((n) => this.getNodeId(n) === parentIds[0]) || null;
    if (!currentNode) {
      throw new Error(`No node found at path "${targetPath}"`);
    }
    parentIds.shift();

    while (parentIds.length > 0) {
      const nextId = parentIds[0];
      // make sure node is loaded before looking for its children
      await this.loadNodeWithSignal(
        currentNode as D3Node & { omeNode: OmeNode & { path: OmePath } }
      );
      const child = this.nodes.find(
        (n) => n.parentId === currentNode!.id && this.getNodeId(n) === nextId
      );
      if (!child) {
        throw new Error(
          `Node at path "${this.getNodeId(currentNode!)}" had no child with ID "${nextId}"`
        );
      }
      currentNode = child;
      parentIds.shift();
    }

    // Finally, let's load the target node
    this.selectNode(currentNode);
    await this.loadNodeWithSignal(currentNode as D3Node & { omeNode: OmeNode & { path: OmePath } });

    return currentNode!;
  }

  async recursiveLoad(autoloadDepth: number) {
    if (autoloadDepth === Infinity || autoloadDepth > 0) {
      let loaded = false;
      for (const leave of this.hierarchy!.leaves()) {
        if ('path' in leave.data.omeNode) {
          const node = leave.data as D3Node & { omeNode: OmeNode & { path: OmePath } };
          if (!node.loaded && !node.error && !(node.omeNode.type == 'singlescale')) {
            await this.loadNode(node);
            loaded = true;
          }
        }
      }
      if (loaded) {
        await this.recursiveLoad(autoloadDepth === Infinity ? Infinity : autoloadDepth - 1);
      }
    }
    this.signalChange();
  }

  buildHierarchy() {
    this.hierarchy = d3.stratify<D3Node>()(this.nodes);
  }

  async loadNode(node: D3Node & { omeNode: OmeNode & { path: OmePath } }) {
    if (node.loading || node.loaded || node.error || node.omeNode.type == 'singlescale') {
      return;
    }
    // this.signalError(null);
    node.loading = true;
    try {
      switch (node.omeNode.path.type) {
        case 'json':
          {
            const resolvedPath = this.resolvePath(node.resolvedPath, node.omeNode.path.path);
            const ome = await this.loader.loadNode(resolvedPath);
            // just updates the 'attributes' from ome - NOT the child ome.nodes
            this.updateNode(node, ome);
            this.appendSubtree(
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
            this.appendSubtree(ome, this.resolvePath(node.resolvedPath, node.omeNode.path.path));
          }
          break;
        default:
          this.signalError(`Unexpected path type: ${node.omeNode.path.type}`);
          break;
      }
    } catch (err) {
      if (err instanceof UntrustedDomainError) {
        node.loading = false;
        if (
          window.confirm(
            `The viewer is trying to load resources from ${err.domain}. Do you want to trust this domain?`
          )
        ) {
          this.loader.addTrustedDomain(err.domain);
          await this.loadNode(node);
        } else {
          this.signalError(err.message);
        }
        return;
      }
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
    if (!(path.startsWith('./') || path.startsWith('http')) || path.includes('..')) {
      throw new Error(`Unsupported path "${path}"`);
    }
    if (path.startsWith('http')) {
      return path;
    }
    parentPath = parentPath.replace(/^\.\//, '').replace(/\/$/, '');
    path = path.replace(/^\.\//, '').replace(/\/$/, '');
    if (parentPath.startsWith('http')) {
      return `${parentPath}/${path}`;
    }
    return parentPath ? `./${parentPath}/${path}` : `./${path}`;
  }

  appendSubtree(ome: OmeNode, resolvedPath: string) {
    const nodes: Array<D3Node> = [];
    const extraEdges: Array<{ sourceId: string; targetId: string }> = [];
    this.walk(nodes, ome, null, resolvedPath, extraEdges);
    if (nodes.length > 0) {
      this.nodes.push(...nodes.splice(1));
    }
    this.buildHierarchy();
  }

  countUnloadedNodes(type: string) {
    return this.nodes.filter((node) => !node.loaded && node.omeNode.type === type).length;
  }
}
