import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, NODE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';
import { createThumbnailImg } from './../thumbnail';

export class ImagesView {
  private graph: NGFFGraph;
  private containerId: string;
  private rootElement: HTMLDivElement;
  private errorAlert: HTMLDivElement;

  private nodeSelectHandler: (node: D3Node) => void = () => {};
  private backgroundClickHandler: () => void = () => {};

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;
    this.containerId = containerId;
    this.errorAlert = document.createElement('div');
    this.errorAlert.classList.add(
      `${CSS_CLASS_PREFIX}alert`,
      `${CSS_CLASS_PREFIX}error`,
      `${CSS_CLASS_PREFIX}alert-fixed`,
      `${CSS_CLASS_PREFIX}hide`
    );
    document.getElementById(this.containerId)?.appendChild(this.errorAlert);

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target !== this.rootElement) return;
      this.backgroundClickHandler();
    };
    document.getElementById(this.containerId)?.appendChild(this.rootElement);

    graph.onChange(() => this.renderTree());
    graph.onError((message) =>
      message === null ? this.hideErrorAlert() : this.showErrorAlert(message)
    );
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
    // We only render multiscale nodes
    if (!(node.omeNode.type == 'multiscale')) return;

    const nodeElement = document.createElement('div');

    const parentId = parent ? parent.id : null;
    nodeElement.title = `ID: ${node.id}\nparentId: ${parentId ?? 'none'}`;
    // nodeElement.id = `node-${node.id}`;

    // Add a button to load children and toggle the collapsed class of the node
    const button = document.createElement('button');
    button.style.borderColor = NODE_COLORS[node.omeNode.type] || NODE_COLORS.default;
    button.textContent = `${node.omeNode?.name}`;
    nodeElement.appendChild(button);
    button.onclick = async () => {
      this.selectNode(node);
      if (!node.loaded) {
        await this.graph.loadNodeWithSignal(
          node as D3Node & { omeNode: OmeNode & { path: OmePath } }
        );
        // TODO - try again to show thumbnail...
      }
    };

    // Add Thumbnail for the node
    const prefix = this.graph.getLoader().getPrefix();
    let resolvedPath = node.resolvedPath;
    if ('path' in node.omeNode && node.omeNode.path?.path) {
      resolvedPath = this.graph.resolvePath(node.resolvedPath, node.omeNode.path.path);
    }
    const baseUrl =
      prefix + (resolvedPath.startsWith('./') ? resolvedPath.substring(1) : resolvedPath);
    // if the node has in-line 'singlescale' nodes, they contain all info the thumbnail needs
    if ('nodes' in node.omeNode) {
      nodeElement.appendChild(createThumbnailImg(node, baseUrl, 150));
    } else {
      // or traverse the graph to get child nodes (will get empty list if node not loaded)
      const children = this.graph.getChildren(node).map((child) => child.omeNode);
      nodeElement.appendChild(createThumbnailImg(node, baseUrl, 150, children));
    }

    this.rootElement.appendChild(nodeElement);
  }

  showErrorAlert(message: string) {
    this.errorAlert.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    this.errorAlert.appendChild(span);
    const button = document.createElement('button');
    button.innerHTML = '&times;';
    button.onclick = () => this.hideErrorAlert();
    this.errorAlert.appendChild(button);
    this.errorAlert.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  hideErrorAlert() {
    this.errorAlert.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }
}
