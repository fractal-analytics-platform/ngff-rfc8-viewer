import type { D3Node } from './../types';
import { CSS_CLASS_PREFIX } from './../constants';
import type { NGFFGraph } from './../graph';
import { createThumbnailImg } from './../thumbnail';
import { displayName } from './../nodes';

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
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}images-graph-root`);
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
    const unloadedCollections = this.graph.countUnloadedNodes('collection');
    const unloadedMultiscales = this.graph.countUnloadedNodes('multiscale');
    let message = '';
    if (unloadedCollections > 0) {
      message = `${unloadedCollections} collections are not loaded.
      Not all images are shown. Click the "Load All Nodes" button above.`;
    } else if (unloadedMultiscales > 0) {
      message = `Some multiscale nodes are not loaded.
      Thumbnails won't be displayed. Click nodes below to load.`;
    }
    if (message) {
      const msg = document.createElement('div');
      msg.textContent = message;
      msg.style.margin = '0 0 1em 0';
      msg.classList.add(`${CSS_CLASS_PREFIX}alert`, `${CSS_CLASS_PREFIX}warning`);
      this.rootElement.appendChild(msg);
    }
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

    // Add Thumbnail for the node (the multiscale document must be loaded to know its scales)
    let thumbnailElement: HTMLElement = node.loaded
      ? createThumbnailImg(node, 100)
      : this.createPlaceholder(100);
    nodeElement.appendChild(thumbnailElement);

    // Add image info (name, ID and parent IDs)
    const imgInfoElement = document.createElement('div');
    imgInfoElement.appendChild(document.createElement('h2')).textContent = displayName(
      node.omeNode
    );
    imgInfoElement.appendChild(document.createTextNode(this.graph.getParentsIds(node).join('/')));
    nodeElement.appendChild(imgInfoElement);

    // Click on row to select node. If not loaded, load it and update the thumbnail.
    nodeElement.onclick = async () => {
      this.selectNode(node);
      if (!node.loaded) {
        await this.graph.loadNodeWithSignal(node);
        // try again to show thumbnail...
        thumbnailElement.remove();
        thumbnailElement = createThumbnailImg(node, 100);
        nodeElement.prepend(thumbnailElement);
      }
    };

    this.rootElement.appendChild(nodeElement);
  }

  private createPlaceholder(width: number): HTMLDivElement {
    const container = document.createElement('div');
    container.style.width = `${width}px`;
    container.style.height = `${width}px`;
    container.classList.add(`${CSS_CLASS_PREFIX}thumbnail-container`);
    container.title = 'Click to load the multiscale document';
    return container;
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
