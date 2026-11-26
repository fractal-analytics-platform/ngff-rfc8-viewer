import { validate } from '@fractal-analytics-platform/ngff-rfc8-validator';
import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node } from './types';
import { NGFFGraph } from './graph';
import { createThumbnailImg } from './thumbnail';
import type { NGFFResolver } from './resolver';
import type { NGFFGraphPage } from './pages/graph';

const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 150;
const MIN_SPACE = 100;
const SMALL_SCREEN_BREAKPOINT = 768;

export class NGFFSidebar {
  private page: NGFFGraphPage;
  private graph: NGFFGraph;
  private resolver: NGFFResolver;
  private element: HTMLElement;
  private content: HTMLElement;

  private node: D3Node | undefined = undefined;

  constructor(page: NGFFGraphPage, graph: NGFFGraph, resolver: NGFFResolver) {
    this.page = page;
    this.graph = graph;
    this.resolver = resolver;
    this.element = document.createElement('div');
    this.content = document.createElement('div');
  }

  public render(): HTMLElement {
    this.element.classList.add(`${CSS_CLASS_PREFIX}sidebar`, `${CSS_CLASS_PREFIX}hide`);

    this.buildResizer();

    this.content.classList.add(`${CSS_CLASS_PREFIX}sidebar-content`);
    this.element.appendChild(this.content);

    this.setWidth(DEFAULT_WIDTH);

    return this.element;
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
      if (!resizing) {
        return;
      }

      const delta = e.clientX - startX;
      const newWidth = startWidth - delta;
      const maxWidth = document.documentElement.clientWidth - MIN_SPACE;

      if (newWidth >= MIN_WIDTH && newWidth <= maxWidth) {
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
    if (viewportWidth <= SMALL_SCREEN_BREAKPOINT) {
      return;
    }
    if (width > viewportWidth - MIN_SPACE) {
      width = viewportWidth - MIN_SPACE;
    }
    this.element.style.width = `${width}px`;
    this.element.style.minWidth = `${width}px`;
  }

  public refresh() {
    this.setNode(this.node);
  }

  public setNode(node?: D3Node) {
    this.node = node;
    this.content.innerHTML = '';

    if (!node) {
      this.hide();
      return;
    }

    this.addKeyValue('Id', 'id' in node.omeNode ? node.omeNode.id : undefined);
    this.addKeyValue('Name', node.omeNode.name);
    this.addKeyValue('Type', node.omeNode.type);
    if (node.omeNode.type === 'array') {
      this.addKeyValue('Index', String(node.index));
    }

    const fullUrl = this.resolver.resolveNode(node, true);

    // Show link to fullUrl json and show path if available
    if ('path' in node.omeNode && node.omeNode.path) {
      this.addKeyValueLink('File loaded from', fullUrl);
      this.addKeyValue('Path', `${node.omeNode.path.href} (type: ${node.omeNode.path.type})`);
    } else {
      this.addKeyValueLink('Node in-line in file', fullUrl);
    }

    // For multiscale nodes, display a thumbnail image
    if (node.omeNode.type === 'multiscale') {
      const baseUrl = this.resolver.getDirectory(fullUrl);
      // if the node has in-line 'array' nodes, they contain all info the thumbnail needs
      if ('data' in node.omeNode) {
        this.content.appendChild(createThumbnailImg(node, baseUrl, 150));
      } else {
        // otherwise we need to traverse the graph to get child nodes
        const children = this.graph.getChildren(node).map((child) => child.omeNode);
        this.content.appendChild(createThumbnailImg(node, baseUrl, 150, children));
      }
    } else if (node.omeNode.type === 'array') {
      this.addArrayInfo(fullUrl);
    }

    this.addFieldValue(node.omeNode, 'coordinateTransformations', 'Coordinate Transformations');
    this.addFieldValue(node.omeNode, 'coordinateSystems', 'Coordinate Systems');

    if (this.page.getValidation()) {
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
          error.textContent = 'Validation errors, see below';
          for (const schemaError of err.schemaErrors) {
            // we log in case node reloading causes the error to be lost
            console.log('Schema Validation error:', schemaError);
            const error = document.createElement('pre');
            error.classList.add(`${CSS_CLASS_PREFIX}`, `${CSS_CLASS_PREFIX}error`);
            error.textContent = JSON.stringify(schemaError, null, 2);
            this.content.appendChild(error);
            errorCount++;
          }
        } else {
          error.textContent = err.message;
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

  private async addArrayInfo(url: string) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        this.addKeyValue('Data Type', data.data_type, 'code');
        this.addKeyValue('Shape', JSON.stringify(data.shape), 'code');
        this.addKeyValue('Dimensions', JSON.stringify(data.dimension_names), 'code');
        this.addFieldValue(data, 'chunk_grid', 'Chunk grid');
      } else {
        this.addErrorElement(
          `Unable to fetch array info. Server replied with ${response.status} status.`
        );
      }
    } catch (err) {
      this.addErrorElement(
        `Error while adding array info. Cause is: ${err instanceof Error ? err.message : 'Unexpected error'}`
      );
    }
  }

  private addErrorElement(message: string) {
    const errorElement = document.createElement('div');
    errorElement.classList.add(`${CSS_CLASS_PREFIX}error`);
    errorElement.textContent = message;
    this.content.append(errorElement);
  }

  private addTitle(value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = value;
    p.appendChild(title);
    this.content.appendChild(p);
  }

  private addFieldValue(node: Record<string, any>, key: string, label: string) {
    if (key in node) {
      this.addTitle(label);
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(node[key], null, 2);
      this.content.appendChild(pre);
    }
  }

  private addKeyValue(key: string, value: string | undefined, tag = 'span') {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    const text = document.createElement(tag);
    title.textContent = `${key}: `;
    text.textContent = value || '-';
    p.appendChild(title);
    p.appendChild(text);
    this.content.appendChild(p);
  }

  private addKeyValueLink(key: string, url: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    const link = document.createElement('a');
    title.textContent = `${key}: `;
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    p.appendChild(title);
    p.appendChild(link);
    this.content.appendChild(p);
  }

  private hide() {
    this.element.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }
}
