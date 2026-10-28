import * as d3 from 'd3';
import type {
  D3Node,
  ExtensionManifestEntry,
  ExtraEdge,
  ExtraEdgesFn,
  OmeDocument,
  OmeNode
} from './types';
import { UntrustedDomainError, type NGFFLoader } from './loader';
import { documentUrlFor } from './paths';
import { displayName, findManifestEntry, mergeTraits } from './nodes';

export class NGFFGraph {
  private loader: NGFFLoader;
  private autoloadDepth: number;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<ExtraEdge> = [];

  private hierarchy: d3.HierarchyNode<D3Node> | undefined;

  private eventListeners = {
    loading: [] as Array<(loading: boolean) => void>,
    error: [] as Array<(message: string | null) => void>,
    nodeUpdated: [] as Array<(node: D3Node) => void>,
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

  getLoader() {
    return this.loader;
  }

  signalLoading(loading: boolean) {
    this.eventListeners['loading'].forEach((fn) => fn(loading));
  }

  signalError(message: string | null) {
    this.eventListeners['error'].forEach((fn) => fn(message));
  }

  signalNodeUpdated(node: D3Node) {
    this.eventListeners['nodeUpdated'].forEach((fn) => fn(node));
  }

  signalChange() {
    this.eventListeners['change'].forEach((fn) => fn());
  }

  // Convenience methods for adding event listeners
  onLoading(fn: (loading: boolean) => void) {
    this.eventListeners['loading'].push(fn);
  }

  onError(fn: (message: string | null) => void) {
    this.eventListeners['error'].push(fn);
  }

  onNodeUpdated(fn: (node: D3Node) => void) {
    this.eventListeners['nodeUpdated'].push(fn);
  }

  onChange(fn: () => void) {
    this.eventListeners['change'].push(fn);
  }

  getHierarchy(): d3.HierarchyNode<D3Node> {
    return this.hierarchy!;
  }

  getNodes(): ReadonlyArray<D3Node> {
    return this.nodes;
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

  /**
   * Adds `node` and its declared children (recursively) to `nodes`. `documentUrl` is the metadata
   * file that declares the node; relative paths are resolved against it.
   */
  walk(
    nodes: Array<D3Node>,
    node: OmeNode,
    parentId: string | null,
    documentUrl: string,
    manifest: ExtensionManifestEntry[] | undefined = undefined
  ) {
    this.lastGeneratedId++;
    const generatedId = String(this.lastGeneratedId);

    let targetUrl: string | undefined;
    let error = false;
    if (node.path) {
      try {
        targetUrl = documentUrlFor(node.path, documentUrl);
      } catch (err) {
        error = true;
        this.signalError(
          `Unable to resolve the path of node "${displayName(node)}": ${err instanceof Error ? err.message : err}`
        );
      }
    }

    nodes.push({
      id: generatedId,
      omeNode: this.getBasicOmeNode(node),
      parentId: parentId,
      documentUrl,
      targetUrl,
      manifest,
      loading: false,
      // nodes pointing to a document are loaded only once it has been fetched;
      // nodes with a data path (extension path types) have nothing to fetch
      loaded: !targetUrl && !error,
      error,
      collapsed: false
    });

    // multiscale documents may carry an empty `nodes` list; scales are not child nodes
    if (node.type !== 'multiscale' && node.nodes) {
      node.nodes.forEach((child) => this.walk(nodes, child, generatedId, documentUrl));
    }
  }

  /**
   * Copy of the node without its children (represented by the hierarchy) and without the
   * document-level keys (`version`, `extension_manifest`, kept on the D3Node as `manifest`).
   */
  private getBasicOmeNode(node: OmeNode): OmeNode {
    const nodeCopy = { ...node };
    delete nodeCopy.nodes;
    delete (nodeCopy as Partial<OmeDocument>).version;
    delete (nodeCopy as Partial<OmeDocument>).extension_manifest;
    return nodeCopy;
  }

  async render(ome: OmeDocument) {
    this.walk(this.nodes, ome, null, this.loader.getSource(), ome.extension_manifest);
    this.buildHierarchy();

    if (this.autoloadDepth > 0) {
      this.signalLoading(true);
      await this.recursiveLoad(this.autoloadDepth);
      this.signalLoading(false);
    }

    this.signalChange();
  }

  /** Loads a node, signalling loading state to listeners. */
  async loadNodeWithSignal(node: D3Node) {
    this.signalLoading(true);
    try {
      await this.loadNode(node);
    } finally {
      this.signalLoading(false);
    }
  }

  /** The RFC-8 id of a node (required, globally unique UUID). */
  getNodeId(node: D3Node): string {
    return node.omeNode.id;
  }

  getChildren(node: D3Node): Array<D3Node> {
    return this.nodes.filter((n) => n.parentId === node.id);
  }

  getParent(node: D3Node): D3Node | undefined {
    return node.parentId ? this.nodes.find((n) => n.id === node.parentId) : undefined;
  }

  getParentsIds(node: D3Node): Array<string> {
    const parents: Array<string> = [];
    parents.push(this.getNodeId(node));
    let current: D3Node | undefined = node;
    while ((current = this.getParent(current))) {
      parents.push(this.getNodeId(current));
    }
    return parents.reverse();
  }

  /** Finds a node by its RFC-8 id (first match; the same id may appear once per document). */
  findNodeByOmeId(id: string): D3Node | undefined {
    return this.nodes.find((n) => n.omeNode.id === id);
  }

  /** The manifest entry covering an extension type, searched in every loaded document. */
  findManifestEntry(type: string): ExtensionManifestEntry | undefined {
    const entries = this.nodes.flatMap((n) => n.manifest ?? []);
    return findManifestEntry(type, entries);
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
      await this.loadNodeWithSignal(currentNode);
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
    await this.loadNodeWithSignal(currentNode);

    return currentNode!;
  }

  async recursiveLoad(autoloadDepth: number) {
    if (autoloadDepth === Infinity || autoloadDepth > 0) {
      let loaded = false;
      for (const leave of this.hierarchy!.leaves()) {
        const node = leave.data;
        if (node.targetUrl && !node.loaded && !node.error) {
          await this.loadNode(node);
          loaded = true;
        }
      }
      if (loaded) {
        await this.recursiveLoad(autoloadDepth === Infinity ? Infinity : autoloadDepth - 1);
      }
    }
  }

  buildHierarchy() {
    this.hierarchy = d3.stratify<D3Node>()(this.nodes);
    this.extraEdges = this.computeExtraEdges ? this.computeExtraEdges(this.nodes) : [];
  }

  /** URLs of the documents enclosing a node (its own document and all ancestors' documents). */
  getAncestorDocumentUrls(node: D3Node): Set<string> {
    const urls = new Set<string>();
    let current: D3Node | undefined = node;
    while (current) {
      urls.add(current.documentUrl);
      current = this.getParent(current);
    }
    return urls;
  }

  /** Fetches the document a node points to and merges it into the node. */
  async loadNode(node: D3Node) {
    if (node.loading || node.loaded || node.error || !node.targetUrl) {
      return;
    }
    this.signalError(null);
    node.loading = true;
    try {
      if (this.getAncestorDocumentUrls(node).has(node.targetUrl)) {
        throw new Error(
          `Cycle detected: node "${displayName(node.omeNode)}" resolves to ${node.targetUrl}, which is one of its enclosing documents`
        );
      }
      const ome = await this.loader.loadNode(node.targetUrl);
      this.updateNode(node, ome);
      this.appendSubtree(ome, node);
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

  /**
   * Merges a fetched document into the node that declares it: the document supplies type-specific
   * fields and traits; traits of the declaring node override same-type traits of the document; the
   * declaring node's name wins when set. The two must share id and type.
   */
  updateNode(node: D3Node, ome: OmeDocument) {
    const entry = node.omeNode;
    if (ome.id !== entry.id) {
      throw new Error(
        `Id mismatch: node "${entry.id}" resolves to a document whose root id is "${ome.id}" (${node.targetUrl})`
      );
    }
    if (ome.type !== entry.type) {
      throw new Error(
        `Type mismatch: node "${displayName(entry)}" has type "${entry.type}" but resolves to a document of type "${ome.type}" (${node.targetUrl})`
      );
    }
    const root: OmeNode = { ...ome };
    delete (root as Partial<OmeDocument>).version;
    delete (root as Partial<OmeDocument>).extension_manifest;
    delete root.nodes;

    const traits = mergeTraits(root.traits, entry.traits);
    const merged: OmeNode = { ...root, type: entry.type, id: entry.id };
    if (entry.name ?? root.name) {
      merged.name = entry.name ?? root.name;
    }
    if (traits.length > 0) {
      merged.traits = traits;
    } else {
      delete merged.traits;
    }
    if (entry.path) {
      merged.path = entry.path;
    }
    node.omeNode = merged;
    node.manifest = ome.extension_manifest;
    node.loaded = true;
    this.signalNodeUpdated(node);
  }

  /** Adds the children declared in a fetched document under the node that points to it. */
  appendSubtree(ome: OmeDocument, node: D3Node) {
    if (ome.type !== 'multiscale' && ome.nodes && node.targetUrl) {
      const nodes: Array<D3Node> = [];
      ome.nodes.forEach((child) => this.walk(nodes, child, node.id, node.targetUrl!));
      this.nodes.push(...nodes);
    }
    this.buildHierarchy();
  }

  countUnloadedNodes(type: string) {
    return this.nodes.filter((node) => !node.loaded && node.omeNode.type === type).length;
  }
}
