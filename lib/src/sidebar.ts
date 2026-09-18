import { CSS_CLASS_PREFIX } from './constants';
import type { OmeNode } from './types';

export class NGFFSidebar {
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  showInfo(node: OmeNode) {
    this.element.innerHTML = '';

    this.addKeyValue('Id', node.id || '-');
    this.addKeyValue('Name', node.name);
    this.addKeyValue('Type', node.type);

    if (node.attributes) {
      this.addTitle('Attributes');
      const pre = document.createElement('pre');
      pre.innerText = JSON.stringify(node.attributes, null, 2);
      this.element.appendChild(pre);
    } else {
      this.addKeyValue('Attributes', '-');
    }

    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
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
}
