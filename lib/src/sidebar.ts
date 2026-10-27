import { validate } from '@fractal-analytics-platform/ngff-rfc8-validator';
import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node } from './types';
import { NGFFGraph } from './graph';
import { createThumbnailImg } from './thumbnail';

const defaultWidth = 560;
const minWidth = 150;
const minSpace = 100;
const smallScreenBreakpoint = 768;
// validation errors to ignore for *unloaded* multiscale nodes only
const IGNORED_ERRORS_FOR_UNLOADED_MULTISCALE = [
  "must have required property 'attributes'",
  'must match "then" schema'
];

export class NGFFSidebar {
  private element: HTMLElement;
  private content: HTMLElement;
  private node: D3Node | null = null;
  private graph: NGFFGraph;

  constructor(element: HTMLElement, graph: NGFFGraph) {
    this.element = element;
    this.graph = graph;

    // Listen for loading & update events from the graph to refresh the sidebar if needed
    graph.addLoadingListener((loading) => {
      if (!loading && this.isOpen()) {
        // If the current node is a multiscale node with remote children (now loaded),
        // showInfo() to display thumbnail
        if (
          this.node &&
          this.node.omeNode.type == 'multiscale' &&
          !('nodes' in this.node.omeNode)
        ) {
          this.showInfo(this.node);
        }
      }
    });
    graph.addNodeUpdatedListener((node) => {
      if (this.isOpen()) {
        this.showInfo(node);
      }
    });
    graph.addNodeSelectedListener((node) => {
      if (node) {
        this.showInfo(node);
      } else {
        this.content.innerHTML = '';
        this.hide();
      }
    });

    element.classList.add(`${CSS_CLASS_PREFIX}sidebar`, `${CSS_CLASS_PREFIX}hide`);

    this.buildResizer();

    const content = document.createElement('div');
    content.classList.add(`${CSS_CLASS_PREFIX}sidebar-content`);
    element.appendChild(content);
    this.content = content;

    this.setWidth(defaultWidth);
  }

  private buildResizer() {
    const resizer = document.createElement('div');
    resizer.classList.add(`${CSS_CLASS_PREFIX}sidebar-resizer`);
    this.element.appendChild(resizer);

    let resizing = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e: MouseEvent) => {
      resizing = true;
      startX = e.clientX;
      startWidth = this.element.offsetWidth;
      document.addEventListener('selectstart', preventSelect);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const preventSelect = (e: Event) => {
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      const delta = e.clientX - startX;
      const newWidth = startWidth - delta;
      const maxWidth = document.documentElement.clientWidth - minSpace;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        this.setWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      resizing = false;
      document.removeEventListener('selectstart', preventSelect);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);
  }

  private setWidth(width: number) {
    const viewportWidth = document.documentElement.clientWidth;
    if (viewportWidth <= smallScreenBreakpoint) {
      return;
    }
    if (width > viewportWidth - minSpace) {
      width = viewportWidth - minSpace;
    }
    this.element.style.width = `${width}px`;
    this.element.style.minWidth = `${width}px`;
  }

  showInfo(node: D3Node) {
    this.node = node;
    this.content.innerHTML = '';

    this.addKeyValue('Id', node.omeNode.id || '-');
    this.addKeyValue('Name', node.omeNode.name);
    this.addKeyValue('Type', node.omeNode.type);

    // For multiscale nodes, display a thumbnail image
    if (node.omeNode.type == 'multiscale') {
      const prefix = this.graph.getLoader().getPrefix();
      let resolvedPath = node.resolvedPath;
      if ('path' in node.omeNode && node.omeNode.path?.path) {
        resolvedPath = this.graph.resolvePath(node.resolvedPath, node.omeNode.path.path);
      }
      // Construct the base URL for the thumbnailZarr store
      // resolvedPath either starts with './' or is an absolute URL
      const baseUrl = resolvedPath.startsWith('./')
        ? prefix + resolvedPath.substring(1)
        : resolvedPath;
      // if the node has in-line 'singlescale' nodes, they contain all info the thumbnail needs
      if ('nodes' in node.omeNode) {
        this.content.appendChild(createThumbnailImg(node, baseUrl, 150));
      } else {
        // otherwise we need to traverse the graph to get child nodes
        const children = this.graph.getChildren(node).map((child) => child.omeNode);
        this.content.appendChild(createThumbnailImg(node, baseUrl, 150, children));
      }
    }

    if ('path' in node.omeNode) {
      this.addKeyValue('Path', `${node.omeNode.path?.path} (type: ${node.omeNode.path?.type})`);
    }

    if (node.omeNode.attributes) {
      this.addTitle('Attributes');
      const pre = document.createElement('pre');
      pre.innerText = JSON.stringify(node.omeNode.attributes, null, 2);
      this.content.appendChild(pre);
    } else {
      this.addKeyValue('Attributes', '-');
    }

    if (this.graph.getValidation()) {
      this.showValidation(node);
    } else {
      this.element.classList.remove(`${CSS_CLASS_PREFIX}has-error`);
    }

    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  private showValidation(node: D3Node) {
    this.element.classList.remove(`${CSS_CLASS_PREFIX}has-error`);
    try {
      validate(this.buildValidatableNode(node));
    } catch (err) {
      if (err instanceof Error) {
        const error = document.createElement('div');
        error.classList.add(`${CSS_CLASS_PREFIX}error`);
        let errorCount = 0;
        if (
          'schemaErrors' in err &&
          Array.isArray(err.schemaErrors) &&
          err.schemaErrors.length > 0
        ) {
          const toIgnore =
            !node.loaded && node.omeNode.type === 'multiscale'
              ? IGNORED_ERRORS_FOR_UNLOADED_MULTISCALE
              : [];

          error.innerText = 'Validation errors, see below';
          for (const schemaError of err.schemaErrors.filter(
            (se) => !toIgnore.includes(se.message)
          )) {
            // we log in case node reloading causes the error to be lost
            console.log('Schema Validation error:', schemaError);
            const error = document.createElement('pre');
            error.classList.add(`${CSS_CLASS_PREFIX}`, `${CSS_CLASS_PREFIX}error`);
            error.innerText = JSON.stringify(schemaError, null, 2);
            this.content.appendChild(error);
            errorCount++;
          }
        } else {
          error.innerText = err.message;
          errorCount++;
        }
        if (errorCount === 0) {
          return;
        }
        this.content.prepend(error);
        this.element.classList.add(`${CSS_CLASS_PREFIX}has-error`);
      }
    }
  }

  private buildValidatableNode(node: D3Node) {
    const omeNode: any = { ...node.omeNode };
    if (node.parentId && !('version' in omeNode)) {
      // Add dummy version for validating non-root nodes
      omeNode.version = '0.x';
    }
    if (
      !('path' in omeNode) &&
      !('nodes' in omeNode) &&
      ['collection', 'multiscale'].includes(omeNode.type)
    ) {
      omeNode.nodes = [];
    }
    return { ome: omeNode };
  }

  private addTitle(value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    title.innerText = value;
    p.appendChild(title);
    this.content.appendChild(p);
  }

  private addKeyValue(key: string, value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    const text = document.createElement('span');
    title.innerText = `${key}: `;
    text.innerText = value || '-';
    p.appendChild(title);
    p.appendChild(text);
    this.content.appendChild(p);
  }

  hide() {
    this.element.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }

  isOpen() {
    return !this.element.classList.contains(`${CSS_CLASS_PREFIX}hide`);
  }
}
