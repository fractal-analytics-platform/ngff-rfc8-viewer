import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX } from './../constants';
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
    const msg = document.createElement('div');
    msg.textContent = `Only LOADED multiscale nodes are shown.
    If some images are missing, use the "Load All" or "Load Next" buttons above.`;
    msg.style.marginBottom = '1em';
    this.rootElement.appendChild(msg);
    const descendants = this.graph.getHierarchy().descendants();
    descendants.forEach((d) => {
      this.renderNode(d.data);
    });
  }

  renderNode(node: D3Node) {
    // We only render multiscale nodes
    if (!(node.omeNode.type == 'multiscale')) return;

    const nodeElement = document.createElement('div');
    nodeElement.classList.add(`${CSS_CLASS_PREFIX}image-row`);

    // Add Thumbnail for the node
    const prefix = this.graph.getLoader().getPrefix();
    let resolvedPath = node.resolvedPath;
    if ('path' in node.omeNode && node.omeNode.path?.path) {
      resolvedPath = this.graph.resolvePath(node.resolvedPath, node.omeNode.path.path);
    }
    let thumbnailElement: HTMLElement;
    const baseUrl =
      prefix + (resolvedPath.startsWith('./') ? resolvedPath.substring(1) : resolvedPath);
    // if the node has in-line 'singlescale' nodes, they contain all info the thumbnail needs
    if ('nodes' in node.omeNode) {
      thumbnailElement = createThumbnailImg(node, baseUrl, 150);
    } else {
      // or traverse the graph to get child nodes (will get empty list if node not loaded)
      const children = this.graph.getChildren(node).map((child) => child.omeNode);
      thumbnailElement = createThumbnailImg(node, baseUrl, 100, children);
    }
    nodeElement.appendChild(thumbnailElement);

    // Add image info (ID and parent IDs)
    const imgInfoElement = document.createElement('div');
    imgInfoElement.appendChild(document.createElement('h2')).textContent = node.omeNode?.id || '';
    imgInfoElement.appendChild(document.createTextNode(this.graph.getParentsIds(node).join('/')));
    nodeElement.appendChild(imgInfoElement);

    // Click on row to select node. If not loaded, load it and update the thumbnail.
    nodeElement.onclick = async () => {
      this.selectNode(node);
      if (!node.loaded) {
        await this.graph.loadNodeWithSignal(
          node as D3Node & { omeNode: OmeNode & { path: OmePath } }
        );
        // try again to show thumbnail...
        thumbnailElement.remove();
        const children = this.graph.getChildren(node).map((child) => child.omeNode);
        thumbnailElement = createThumbnailImg(node, baseUrl, 100, children);
        nodeElement.prepend(thumbnailElement);
      }
    };

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
