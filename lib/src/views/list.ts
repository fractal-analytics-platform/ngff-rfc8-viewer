import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, NODE_COLORS, STROKE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';
import type { NGFFView } from './base';

export class ListView implements NGFFView {
  private graph: NGFFGraph;
  private rootElement: HTMLDivElement;

  constructor(graph: NGFFGraph, container: HTMLElement) {
    this.graph = graph;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target !== this.rootElement) {
        return;
      }
      this.selectNode();
    };
    container.appendChild(this.rootElement);
  }

  public async selectNode(node?: D3Node) {
    if (node && !node.loaded) {
      await this.graph.loadNodeWithSignal(
        node as D3Node & { omeNode: OmeNode & { path: OmePath } }
      );
    }
    this.graph.signalNodeSelected(node);
    if (node && node.loaded) {
      node.collapsed = !node.collapsed;
    }
    this.render();
  }

  public render() {
    console.log('[ListView] render');

    this.rootElement.innerHTML = '';

    const hierarchy = this.graph.getHierarchy();
    if (!hierarchy) {
      return;
    }

    hierarchy.descendants().forEach((d) => {
      // this renders parent Nodes first, adding each to the DOM.
      // When child nodes are rendered, they are added as children to their respective parent nodes in the DOM.
      this.renderNode(d.data, d.parent?.data);
    });
  }

  private renderNode(node: D3Node, parent: D3Node | undefined) {
    const isLoaded = node.loaded;
    const isRemote = 'path' in node.omeNode;
    const isCollapsed = node.collapsed || !isLoaded;
    const hasChildren = ['multiscale', 'collection'].includes(node.omeNode.type);
    const nodeElement = document.createElement('div');

    nodeElement.title = `ID: ${this.getOmeId(node)}\nparentId: ${this.getOmeId(parent)}`;
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
    button.textContent = `${node.omeNode.name || ('id' in node.omeNode ? node.omeNode.id : node.index)}`;
    nodeElement.appendChild(button);
    button.onclick = async () => {
      this.selectNode(node);
      return false;
    };
    if (parent) {
      document.getElementById(`node-${parent.id}`)?.appendChild(nodeElement);
    } else {
      this.rootElement.appendChild(nodeElement);
    }
  }

  private getOmeId(node: D3Node | undefined) {
    return node && 'id' in node.omeNode ? node.omeNode.id : 'none';
  }

  public destroy(): void {}
}
