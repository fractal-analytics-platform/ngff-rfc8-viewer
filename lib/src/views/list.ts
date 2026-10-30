import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, NODE_COLORS, STROKE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';

export class ListView {
  private graph: NGFFGraph;
  private containerId: string;
  private rootElement: HTMLDivElement;
  private unsubscribers: Array<() => void> = [];

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;
    this.containerId = containerId;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target !== this.rootElement) {
        return;
      }
      this.selectNode();
    };
    document.getElementById(this.containerId)?.appendChild(this.rootElement);

    // This is triggered when tree is first loaded
    this.unsubscribers.push(graph.addChangeListener(this.renderTree));
    // Re-render when loading completes
    this.unsubscribers.push(
      graph.addLoadingListener((isLoading) => {
        if (!isLoading) {
          this.renderTree();
        }
      })
    );
    // re-render the tree when a node is selected
    this.unsubscribers.push(
      graph.addNodeSelectedListener(() => {
        this.renderTree();
      })
    );

    // initial render
    this.renderTree();
  }

  selectNode(node?: D3Node) {
    this.graph.selectNode(node);
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
    const isRemote = 'path' in node.omeNode;
    const isCollapsed = node.collapsed || !isLoaded;
    const hasChildren = ['multiscale', 'collection'].includes(node.omeNode.type);
    const nodeElement = document.createElement('div');

    const parentId = parent ? parent.id : null;
    nodeElement.title = `ID: ${node.id}\nparentId: ${parentId ?? 'none'}`;
    nodeElement.id = `node-${node.id}`;
    nodeElement.style.opacity = isLoaded ? '1' : '0.5';
    nodeElement.style.paddingTop = isRemote ? '10px' : '2px';
    nodeElement.style.paddingBottom = isRemote ? '10px' : '2px';
    nodeElement.className = `${CSS_CLASS_PREFIX}node-element ${isCollapsed ? `${CSS_CLASS_PREFIX}collapsed` : ''} ${hasChildren ? `${CSS_CLASS_PREFIX}has-children` : ''}`;

    // Add a button to load children and toggle the collapsed class of the node
    const button = document.createElement('button');
    button.style.borderColor = node.selected
      ? STROKE_COLORS.selected
      : NODE_COLORS[node.omeNode.type] || NODE_COLORS.default;
    button.style.borderWidth = node.selected ? '3px' : '1px';
    button.textContent = `${node.omeNode?.name}`;
    nodeElement.appendChild(button);
    button.onclick = async () => {
      this.selectNode(node);
      // unloaded nodes are actually expanded already - don't toggle collapsed. Just load...
      if (node.loaded) {
        node.collapsed = !node.collapsed;
      }
      await this.graph.loadNodeWithSignal(
        node as D3Node & { omeNode: OmeNode & { path: OmePath } }
      );
      return false;
    };
    if (parentId) {
      document.getElementById(`node-${parentId}`)?.appendChild(nodeElement);
    } else {
      this.rootElement.appendChild(nodeElement);
    }
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    if (this.rootElement) {
      this.rootElement.remove();
    }
  }
}
