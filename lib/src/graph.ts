import * as d3 from 'd3';
import type { D3Node, ExtraEdgesFn, OmeArray, OmeNode, OmePath } from './types';
import { NGFFLoader, UntrustedDomainError } from './loader';
import type { NGFFResolver } from './resolver';
import type { NGFFGraphPage } from './pages/graph';

export class NGFFGraph {
  private page: NGFFGraphPage;
  private resolver: NGFFResolver;
  private loader: NGFFLoader;
  private autoloadDepth: number;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  private hierarchy: d3.HierarchyNode<D3Node> | undefined;

  constructor(
    page: NGFFGraphPage,
    resolver: NGFFResolver,
    autoloadDepth: number,
    computeExtraEdges: ExtraEdgesFn | undefined = undefined
  ) {
    this.page = page;
    this.resolver = resolver;
    this.loader = new NGFFLoader(resolver);
    this.autoloadDepth = autoloadDepth;
    this.computeExtraEdges = computeExtraEdges;
  }

  public signalLoading(loading: boolean) {
    this.page.signalLoading(loading);
  }

  public signalError(err: unknown) {
    this.page.signalError(err);
  }

  public getResolver(): NGFFResolver {
    return this.resolver;
  }

  public getHierarchy(): d3.HierarchyNode<D3Node> | undefined {
    return this.hierarchy;
  }

  public getExtraEdges() {
    return this.extraEdges;
  }

  public async loadRoot(): Promise<void> {
    try {
      this.signalLoading(true);
      const ome = await this.loader.loadGraphData();

      this.nodes = [];
      this.walk(
        this.nodes,
        ome,
        ome.id,
        null,
        null,
        this.resolver.getRootRelativePath(),
        this.extraEdges
      );
      this.buildHierarchy();

      if (this.autoloadDepth > 0) {
        await this.recursiveLoad(this.autoloadDepth);
      }
    } catch (err) {
      this.signalError(err);
    } finally {
      this.signalLoading(false);
    }
  }

  public signalNodeSelected(node?: D3Node) {
    // clear selected state of all nodes
    this.nodes.forEach((n) => (n.selected = false));
    if (node) {
      node.selected = true;
    }
    this.page.signalNodeSelected(node);
  }

  private walk(
    nodes: Array<D3Node>,
    node: OmeNode | OmeArray,
    id: string,
    parentId: string | null,
    index: number | null,
    resolvedPath: string,
    extraEdges: Array<{ sourceId: string; targetId: string }>
  ) {
    nodes.push({
      id,
      omeNode: { ...node },
      parentId: parentId,
      index: node.type === 'array' ? index : null,
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

    const children = 'nodes' in node ? node.nodes : 'data' in node ? node.data : [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childId = 'id' in child ? child.id : `${id}/${i}`;
      this.walk(nodes, child, childId, id, i, resolvedPath, extraEdges);
    }
  }

  /** Loads a node, signalling loading state to listeners. */
  public async loadNodeWithSignal(node: D3Node & { omeNode: OmeNode & { path: OmePath } }) {
    this.signalLoading(true);
    try {
      await this.loadNode(node);
    } finally {
      this.signalLoading(false);
    }
  }

  public getNode(id: string): D3Node | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  private getNodeOmeId(node: D3Node): string | undefined {
    return 'id' in node.omeNode ? node.omeNode.id : undefined;
  }

  public getChildren(node: D3Node): Array<D3Node> {
    return this.nodes.filter((n) => n.parentId === node.id);
  }

  public getParentsIds(node: D3Node): Array<string> {
    const parents: Array<string> = [];
    if (node.omeNode.type !== 'array') {
      parents.push(node.id);
    }
    let current = node;
    while (current.parentId) {
      const parent = this.nodes.find((n) => n.id === current.parentId);
      if (!parent) {
        break;
      }
      parents.push(parent.id);
      current = parent;
    }
    return parents.reverse();
  }

  // path is a hierarchy of node IDs, e.g. "root/child/grandchild"
  public async loadNodeAtPath(targetPath: string): Promise<D3Node> {
    if (!this.hierarchy) {
      throw new Error('Cannot select a path before the graph has loaded');
    }

    const parentOmeIds = targetPath.split('/');
    let currentNode: D3Node | null = null;
    currentNode = this.nodes.find((n) => this.getNodeOmeId(n) === parentOmeIds[0]) || null;
    if (!currentNode) {
      throw new Error(`No node found at path "${targetPath}"`);
    }
    parentOmeIds.shift();

    while (parentOmeIds.length > 0) {
      const nextOmeId = parentOmeIds[0];
      // make sure node is loaded before looking for its children
      await this.loadNode(currentNode as D3Node & { omeNode: OmeNode & { path: OmePath } });
      const child = this.nodes.find(
        (n) => n.parentId === currentNode!.id && this.getNodeOmeId(n) === nextOmeId
      );
      if (!child) {
        throw new Error(`Node at path "${currentNode.id}" had no child with ID "${nextOmeId}"`);
      }
      currentNode = child;
      parentOmeIds.shift();
    }

    // Finally, let's load the target node
    await this.loadNode(currentNode as D3Node & { omeNode: OmeNode & { path: OmePath } });

    return currentNode;
  }

  public async recursiveLoad(autoloadDepth: number) {
    if (autoloadDepth === Infinity || autoloadDepth > 0) {
      let loaded = false;
      for (const leave of this.hierarchy!.leaves()) {
        if ('path' in leave.data.omeNode) {
          const node = leave.data as D3Node & { omeNode: OmeNode & { path: OmePath } };
          if (!node.loaded && !node.error && !(node.omeNode.type === 'array')) {
            await this.loadNode(node);
            loaded = true;
          }
        }
      }
      if (loaded) {
        await this.recursiveLoad(autoloadDepth === Infinity ? Infinity : autoloadDepth - 1);
      }
    }
  }

  private buildHierarchy() {
    try {
      this.hierarchy = d3.stratify<D3Node>()(this.nodes);
    } catch (err) {
      if (err instanceof Error && err.message.match(/^ambiguous: .*/)) {
        console.trace(err);
        throw new Error('Graph cycle not supported', { cause: err });
      } else {
        throw err;
      }
    }
  }

  public async loadNode(node: D3Node & { omeNode: OmeNode & { path: OmePath } }) {
    if (node.loading || node.loaded || node.error || node.omeNode.type === 'array') {
      return;
    }
    node.loading = true;
    try {
      const loadPath = this.resolver.resolveNode(node);
      node.resolvedPath = loadPath;
      const ome = await this.loader.loadNode(loadPath);
      this.updateNode(node, ome);
      this.appendSubtree(node, ome, loadPath);
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
          this.signalError(err);
        }
        return;
      }
      node.loaded = false;
      node.error = true;
      this.signalError(err);
    }
    node.loading = false;
  }

  private updateNode(node: D3Node, ome: OmeNode) {
    node.loaded = true;
    node.omeNode = { ...ome };
  }

  private appendSubtree(node: D3Node, ome: OmeNode, resolvedPath: string) {
    const nodes: Array<D3Node> = [];
    const extraEdges: Array<{ sourceId: string; targetId: string }> = [];
    this.walk(nodes, ome, node.id, node.parentId, null, resolvedPath, extraEdges);
    if (nodes.length > 0) {
      this.nodes.push(...nodes.splice(1));
    }
    this.buildHierarchy();
  }

  public countUnloadedNodes(type: string) {
    return this.nodes.filter((node) => !node.loaded && node.omeNode.type === type).length;
  }
}
