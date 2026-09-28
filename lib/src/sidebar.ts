import { validate } from '@fractal-analytics-platform/ngff-rfc8-validator';
import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node, OmeNode } from './types';

export class NGFFSidebar {
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
    element.classList.add(`${CSS_CLASS_PREFIX}sidebar`, `${CSS_CLASS_PREFIX}hide`);
  }

  showInfo(node: D3Node) {
    this.element.innerHTML = '';

    this.addKeyValue('Id', node.omeNode.id || '-');
    this.addKeyValue('Name', node.omeNode.name);
    this.addKeyValue('Type', node.omeNode.type);

    if (node.omeNode.attributes) {
      this.addTitle('Attributes');
      const pre = document.createElement('pre');
      pre.innerText = JSON.stringify(node.omeNode.attributes, null, 2);
      this.element.appendChild(pre);
    } else {
      this.addKeyValue('Attributes', '-');
    }

    this.showValidation(node.omeNode);

    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  private showValidation(omeNode: OmeNode) {
    try {
      validate({ ome: omeNode });
    } catch (err) {
      if (err instanceof Error) {
        const error = document.createElement('div');
        error.classList.add(`${CSS_CLASS_PREFIX}`, `${CSS_CLASS_PREFIX}error`);
        error.innerText = err.message;
        this.element.appendChild(error);
        if ('schemaErrors' in err && Array.isArray(err.schemaErrors)) {
          for (const schemaError of err.schemaErrors) {
            const error = document.createElement('pre');
            error.classList.add(`${CSS_CLASS_PREFIX}`, `${CSS_CLASS_PREFIX}error`);
            error.innerText = JSON.stringify(schemaError, null, 2);
            this.element.appendChild(error);
          }
        }
      }
    }
  }

  private addTitle(value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    title.innerText = value;
    p.appendChild(title);
    this.element.appendChild(p);
  }

  private addKeyValue(key: string, value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    const text = document.createElement('span');
    title.innerText = `${key}: `;
    text.innerText = value || '-';
    p.appendChild(title);
    p.appendChild(text);
    this.element.appendChild(p);
  }

  hide() {
    this.element.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }

  isOpen() {
    return !this.element.classList.contains(`${CSS_CLASS_PREFIX}hide`);
  }
}
