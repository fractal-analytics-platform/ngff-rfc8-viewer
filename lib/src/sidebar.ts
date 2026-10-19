import { validate } from '@fractal-analytics-platform/ngff-rfc8-validator';
import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node } from './types';
import { createThumbnailImg } from './thumbnail';

const defaultWidth = 560;
const minWidth = 150;
const minSpace = 100;
const smallScreenBreakpoint = 768;

export class NGFFSidebar {
  private element: HTMLElement;
  private content: HTMLElement;
  private validationEnabled: boolean;

  constructor(element: HTMLElement, validate: boolean) {
    this.element = element;
    this.validationEnabled = validate;
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
    this.content.innerHTML = '';

    this.addKeyValue('Id', node.omeNode.id || '-');
    this.addKeyValue('Name', node.omeNode.name);
    this.addKeyValue('Type', node.omeNode.type);

    // For multiscale nodes, display a thumbnail image
    if (node.omeNode.type == 'multiscale') {
      this.content.appendChild(createThumbnailImg(node, 150));
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

    if (this.validationEnabled) {
      this.showValidation(node);
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
        this.element.classList.add(`${CSS_CLASS_PREFIX}has-error`);
        error.classList.add(`${CSS_CLASS_PREFIX}error`);
        this.content.prepend(error);
        if (
          'schemaErrors' in err &&
          Array.isArray(err.schemaErrors) &&
          err.schemaErrors.length > 0
        ) {
          error.innerText = 'Validation errors, see below';
          for (const schemaError of err.schemaErrors) {
            const error = document.createElement('pre');
            error.classList.add(`${CSS_CLASS_PREFIX}`, `${CSS_CLASS_PREFIX}error`);
            error.innerText = JSON.stringify(schemaError, null, 2);
            this.content.appendChild(error);
          }
        } else {
          error.innerText = err.message;
        }
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
