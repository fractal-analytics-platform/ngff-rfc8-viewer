import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, STROKE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';
import { createThumbnailImg } from './../thumbnail';
import type { NGFFView } from './base';

const THUMBNAIL_SIZE = 100;
const SCROLL_DEBOUNCE_MS = 50;

export class ImagesView implements NGFFView {
  private graph: NGFFGraph;
  private rootElement: HTMLDivElement;
  private scrollTimeout: ReturnType<typeof setTimeout> | undefined;
  private rendering = false;

  constructor(graph: NGFFGraph, container: HTMLElement) {
    this.graph = graph;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}images-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target === this.rootElement) {
        this.selectNode();
      }
    };
    this.rootElement.addEventListener('scroll', this.onScroll);
    container.appendChild(this.rootElement);
  }

  public selectNode(node?: D3Node) {
    this.graph.signalNodeSelected(node);

    const hierarchy = this.graph.getHierarchy();
    if (!hierarchy) {
      return;
    }

    hierarchy.descendants().forEach((d) => {
      if (d.data.omeNode.type === 'multiscale') {
        const nodeElement = document.getElementById(`image-row-node-${d.data.id}`);
        if (nodeElement) {
          nodeElement.style.borderColor = d.data.selected ? STROKE_COLORS.selected : 'transparent';
        }
      }
    });
  }

  private onScroll = () => {
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => this.loadVisibleThumbnails(), SCROLL_DEBOUNCE_MS);
  };

  // Load thumbnails for image rows that are visible (within rootElement and the window)
  // and don't have one yet.
  private async loadVisibleThumbnails() {
    const rootRect = this.rootElement.getBoundingClientRect();
    const top = Math.max(rootRect.top, 0);
    const bottom = Math.min(rootRect.bottom, window.innerHeight);
    const rows = this.rootElement.querySelectorAll<HTMLElement>(`.${CSS_CLASS_PREFIX}image-row`);
    const thumbnailPromises: Promise<void>[] = [];
    rows.forEach((row) => {
      if (row.querySelector('img') !== null) {
        return;
      }
      const rect = row.getBoundingClientRect();
      if (rect.bottom > top && rect.top < bottom) {
        thumbnailPromises.push(this.loadThumbnail(row));
      }
    });
    await Promise.all(thumbnailPromises);
  }

  private async loadThumbnail(nodeElement: HTMLElement) {
    const nodeId = nodeElement.id.replace('image-row-node-', '');
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return;
    }

    // Add Thumbnail for the node
    const resolver = this.graph.getResolver();
    const fullUrl = resolver.resolveNode(node, true);
    const baseUrl = resolver.getDirectory(fullUrl);

    let thumbnailElement: HTMLElement;
    if ('nodes' in node.omeNode) {
      thumbnailElement = createThumbnailImg(node, baseUrl, THUMBNAIL_SIZE);
    } else {
      // or traverse the graph to get child nodes (will get empty list if node not loaded)
      if (!node.loaded) {
        await this.graph.loadNodeWithSignal(
          node as D3Node & { omeNode: OmeNode & { path: OmePath } }
        );
      }
      const children = this.graph.getChildren(node).map((child) => child.omeNode);
      thumbnailElement = createThumbnailImg(node, baseUrl, THUMBNAIL_SIZE, children);
    }
    const existingThumbnail = nodeElement.querySelector(`.${CSS_CLASS_PREFIX}thumbnail-container`);
    if (existingThumbnail) {
      existingThumbnail.remove();
    }
    nodeElement.prepend(thumbnailElement);
  }

  public async render() {
    console.log('[ImagesView] render');

    if (this.rendering) {
      return;
    }
    this.rendering = true;
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

    const hierarchy = this.graph.getHierarchy();
    if (!hierarchy) {
      this.rendering = false;
      return;
    }

    hierarchy.descendants().forEach((d) => {
      this.renderNode(d.data);
    });
    await this.loadVisibleThumbnails();
    this.rendering = false;
  }

  private renderNode(node: D3Node) {
    // We only render multiscale nodes
    if (!(node.omeNode.type === 'multiscale')) {
      return;
    }

    const nodeElement = document.createElement('div');
    nodeElement.classList.add(`${CSS_CLASS_PREFIX}image-row`);
    nodeElement.id = `image-row-node-${node.id}`;
    nodeElement.style.borderColor = node.selected ? STROKE_COLORS.selected : 'transparent';

    const thumbnailPlaceholder = document.createElement('div');
    thumbnailPlaceholder.style.width = `${THUMBNAIL_SIZE}px`;
    thumbnailPlaceholder.style.height = `${THUMBNAIL_SIZE}px`;
    thumbnailPlaceholder.classList.add(`${CSS_CLASS_PREFIX}thumbnail-container`);
    nodeElement.appendChild(thumbnailPlaceholder);

    // Add image info (ID and parent IDs)
    const imgInfoElement = document.createElement('div');
    imgInfoElement.appendChild(document.createElement('h2')).textContent = node.omeNode?.id || '';
    imgInfoElement.appendChild(document.createTextNode(this.graph.getParentsIds(node).join('/')));
    nodeElement.appendChild(imgInfoElement);

    // Click on row to select node.
    nodeElement.onclick = async () => {
      this.selectNode(node);
    };

    this.rootElement.appendChild(nodeElement);
  }

  public destroy() {
    clearTimeout(this.scrollTimeout);
  }
}
