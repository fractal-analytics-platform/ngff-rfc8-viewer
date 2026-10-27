import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node } from './types';
import { NGFFGraph } from './graph';
import { createThumbnailImg } from './thumbnail';
import { displayName, isExtensionType } from './nodes';

const defaultWidth = 560;
const minWidth = 150;
const minSpace = 100;
const smallScreenBreakpoint = 768;
/**
 * Shown when validation is requested: the external JSON Schema validator
 * (ngff-rfc8-validator) targets the pre-revision RFC-8 schema and there is no
 * revision 1 schema yet, so only the viewer's structural checks are applied.
 */
export const VALIDATION_UNAVAILABLE_MESSAGE =
  'JSON Schema validation is not available for RFC-8 revision 1 documents yet; only structural checks were applied while loading.';

export class NGFFSidebar {
  private element: HTMLElement;
  private content: HTMLElement;
  private validationEnabled: boolean;
  private node: D3Node | null = null;
  private graph: NGFFGraph;

  constructor(element: HTMLElement, validate: boolean, graph: NGFFGraph) {
    this.element = element;
    this.graph = graph;
    this.validationEnabled = validate;

    // Listen for loading & update events from the graph to refresh the sidebar if needed
    graph.onLoading((loading) => {
      if (!loading && this.isOpen()) {
        // If the current node is a multiscale node with remote children (now loaded),
        // showInfo() to display thumbnail
        if (this.node && this.node.omeNode.type == 'multiscale' && this.node.loaded) {
          this.showInfo(this.node);
        }
      }
    });
    graph.onNodeUpdated((node) => {
      if (this.isOpen()) {
        this.showInfo(node);
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

    this.addKeyValue('Id', node.omeNode.id);
    this.addKeyValue('Name', node.omeNode.name ?? `(no name) ${displayName(node.omeNode)}`);
    this.addKeyValue('Type', node.omeNode.type);
    if (isExtensionType(node.omeNode.type)) {
      const entry = this.graph.findManifestEntry(node.omeNode.type);
      this.addKeyValue(
        'Extension',
        entry
          ? `${entry.name ?? entry.id} (version ${entry.version})`
          : 'not declared in any extension_manifest'
      );
    }

    // For multiscale nodes, display a thumbnail image
    if (node.omeNode.type == 'multiscale') {
      if (node.loaded) {
        this.content.appendChild(createThumbnailImg(node, 150));
      } else {
        this.addKeyValue('Thumbnail', 'click the node to load the multiscale document');
      }
    }

    if (node.omeNode.path) {
      const path = node.omeNode.path;
      this.addKeyValue('Path', `${path.href} (type: ${path.type}, format: ${path.format})`);
      if (node.targetUrl) {
        this.addKeyValue('Resolves to', node.targetUrl);
      }
    }

    if (node.omeNode.traits && node.omeNode.traits.length > 0) {
      this.addTitle('Traits');
      const pre = document.createElement('pre');
      pre.innerText = JSON.stringify(node.omeNode.traits, null, 2);
      this.content.appendChild(pre);
    } else {
      this.addKeyValue('Traits', '-');
    }

    if (this.validationEnabled) {
      this.showValidation();
    }

    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  private showValidation() {
    this.element.classList.remove(`${CSS_CLASS_PREFIX}has-error`);
    const notice = document.createElement('div');
    notice.classList.add(`${CSS_CLASS_PREFIX}alert`, `${CSS_CLASS_PREFIX}warning`);
    notice.textContent = VALIDATION_UNAVAILABLE_MESSAGE;
    this.content.prepend(notice);
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
