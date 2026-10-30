import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX, STROKE_COLORS } from './../constants';
import type { NGFFGraph } from './../graph';
import { createThumbnailImg } from './../thumbnail';

const THUMBNAIL_SIZE = 100;
const SCROLL_DEBOUNCE_MS = 50;

export class ImagesView {
  private graph: NGFFGraph;
  private containerId: string;
  private rootElement: HTMLDivElement;
  private unsubscribers: Array<() => void> = [];
  private scrollTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;
    this.containerId = containerId;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}images-graph-root`);
    this.rootElement.onclick = (event) => {
      if (event.target === this.rootElement) {
        this.selectNode();
      }
    };
    this.rootElement.addEventListener('scroll', this.onScroll);
    document.getElementById(this.containerId)?.appendChild(this.rootElement);

    this.unsubscribers.push(graph.addChangeListener(() => this.renderTree()));
    this.unsubscribers.push(
      graph.addNodeSelectedListener(() => {
        const descendants = this.graph.getHierarchy().descendants();
        descendants.forEach((d) => {
          if (d.data.omeNode.type === 'multiscale') {
            const nodeElement = document.getElementById(`image-row-node-${d.data.id}`);
            if (nodeElement) {
              nodeElement.style.borderColor = d.data.selected
                ? STROKE_COLORS.selected
                : 'transparent';
            }
          }
        });
      })
    );

    // initial render of the tree
    this.renderTree();
  }

  selectNode(node?: D3Node) {
    this.graph.selectNode(node!);
  }

  private onScroll = () => {
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => this.loadVisibleThumbnails(), SCROLL_DEBOUNCE_MS);
  };

  // Load thumbnails for image rows that are visible (within rootElement and the window)
  // and don't have one yet.
  private loadVisibleThumbnails() {
    const rootRect = this.rootElement.getBoundingClientRect();
    const top = Math.max(rootRect.top, 0);
    const bottom = Math.min(rootRect.bottom, window.innerHeight);
    const rows = this.rootElement.querySelectorAll<HTMLElement>(`.${CSS_CLASS_PREFIX}image-row`);
    rows.forEach((row) => {
      if (row.querySelector('img') !== null) {
        return;
      }
      const rect = row.getBoundingClientRect();
      if (rect.bottom > top && rect.top < bottom) {
        this.loadThumbnail(row);
      }
    });
  }

  async loadThumbnail(nodeElement: HTMLElement) {
    const nodeId = nodeElement.id.replace('image-row-node-', '');
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return;
    }

    // Add Thumbnail for the node
    const prefix = this.graph.getLoader().getPrefix();
    let parentPath = node.resolvedPath;
    // Convert relative parentPath to an absolute URL if it starts with './'
    if (parentPath.startsWith('./')) {
      parentPath = this.graph.resolvePath(prefix, parentPath);
    }
    // add any node 'path'...
    let fullUrl = parentPath;
    const nodePath = 'path' in node.omeNode ? node.omeNode.path?.path : undefined;
    const zarrType = 'path' in node.omeNode ? node.omeNode.path?.type === 'zarr' : false;
    if (nodePath) {
      const parent = parentPath.substring(0, parentPath.search(/\/[^/]+\.json$/));
      fullUrl = this.graph.resolvePath(parent, nodePath);
    }
    if (zarrType) {
      fullUrl += '/zarr.json';
    }
    const baseUrl = fullUrl.substring(0, fullUrl.search(/\/[^/]+\.json$/));

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
    this.loadVisibleThumbnails();
  }

  renderNode(node: D3Node) {
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

  destroy() {
    clearTimeout(this.scrollTimeout);
    this.rootElement.removeEventListener('scroll', this.onScroll);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.rootElement.remove();
  }
}
