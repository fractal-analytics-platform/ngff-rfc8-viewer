import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, NODE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';

export class ListView {
  private graph: NGFFGraph;
  private containerId: string;
  private rootElement: HTMLDivElement;

  private nodeSelectHandler: (node: D3Node) => void = () => {};
  private backgroundClickHandler: () => void = () => {};

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;
    this.containerId = containerId;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target !== this.rootElement) return;
      this.backgroundClickHandler();
    };
    document.getElementById(this.containerId)?.appendChild(this.rootElement);

    graph.onChange(() => this.renderTree());
    graph.onError((message) => (message === null ? undefined : this.showErrorAlert(message)));
  }

  onNodeSelect(fn: (node: D3Node) => void) {
    this.nodeSelectHandler = fn;
  }

  selectNode(node: D3Node) {
    this.nodeSelectHandler(node);
  }

  onBackgroundClick(fn: () => void) {
    this.backgroundClickHandler = fn;
  }

  renderTree() {
    this.rootElement.innerHTML = '';

    const descendants = this.graph.getHierarchy().descendants();
    descendants.forEach((d) => {
      // this renders parent Nodes first, adding each to the DOM.
      // When child nodes are rendered, they are added as children to their respective parent nodes in the DOM.
      this.renderNode(d.data, d.parent?.data);
    });
  }

  renderNode(node: D3Node, parent: D3Node | undefined) {
    const isLoaded = node.loaded;
    const isCollapsed = node.collapsed || !isLoaded;
    const hasChildren = ['multiscale', 'collection'].includes(node.omeNode.type);
    const nodeElement = document.createElement('div');

    const parentId = parent ? parent.id : null;
    nodeElement.title = `ID: ${node.id}\nparentId: ${parentId ?? 'none'}`;
    nodeElement.id = `node-${node.id}`;
    nodeElement.className = `node-element ${isCollapsed ? 'collapsed' : ''} ${hasChildren ? 'has-children' : ''}`;

    // Add a button to load children and toggle the collapsed class of the node
    const button = document.createElement('button');
    button.style.borderColor = NODE_COLORS[node.omeNode.type] || NODE_COLORS.default;
    button.textContent = `${node.omeNode?.name}`;
    nodeElement.appendChild(button);
    button.onclick = async () => {
      this.selectNode(node);
      // Adding 'collapsed' class will hide child nodes etc.
      nodeElement.classList.toggle('collapsed');
      if (isLoaded) {
        // simply toggle collapsed - don't need to re-render the tree
        node.collapsed = !node.collapsed;
        return;
      }
      await this.graph.loadNodeWithSignal(
        node as D3Node & { omeNode: OmeNode & { path: OmePath } }
      );
      this.renderTree();
    };
    if (parentId) {
      document.getElementById(`node-${parentId}`)?.appendChild(nodeElement);
    } else {
      this.rootElement.appendChild(nodeElement);
    }
  }

  showErrorAlert(message: string) {
    // basic handler for now
    alert(message);
  }
}
