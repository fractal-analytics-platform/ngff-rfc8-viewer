import { CSS_CLASS_PREFIX } from './constants';
import type {
  AcquisitionTrait,
  D3Node,
  ExtensionManifestEntry,
  LabelsTrait,
  OmeNode,
  OmeReference,
  PlateTrait,
  SceneTrait,
  Trait,
  WellTrait
} from './types';
import { NGFFGraph } from './graph';
import { createThumbnailImg } from './thumbnail';
import { displayName, isExtensionType, nodeFields, shortTypeName } from './nodes';
import { resolveHref } from './paths';

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
        // If the current node is a multiscale node (now loaded), showInfo() to display thumbnail
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
    const omeNode = node.omeNode;

    this.addKeyValue('Id', omeNode.id);
    this.addKeyValue('Name', omeNode.name ?? `(no name, shown as ${displayName(omeNode)})`);
    this.addKeyValue('Type', this.typeElement(omeNode.type));

    // For multiscale nodes, display a thumbnail image
    if (omeNode.type == 'multiscale') {
      if (node.loaded) {
        this.content.appendChild(createThumbnailImg(node, 150));
      } else {
        this.addKeyValue('Thumbnail', 'click the node to load the multiscale document');
      }
    }

    this.showPath(node);
    this.showTraits(omeNode);
    if (omeNode.type == 'multiscale' && node.loaded) {
      this.showCoordinateSystems(omeNode);
      this.showScales(node);
    }
    this.showFields(omeNode);
    if (node.manifest && node.manifest.length > 0) {
      this.showManifest(node.manifest);
    }

    if (this.validationEnabled) {
      this.showValidation();
    }

    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  private showPath(node: D3Node) {
    const path = node.omeNode.path;
    if (!path) {
      return;
    }
    this.addKeyValue('Path', `${path.href} (type: ${path.type}, format: ${path.format})`);
    if (node.targetUrl) {
      this.addKeyValue('Resolves to', this.link(node.targetUrl, node.targetUrl));
    } else {
      try {
        const url = resolveHref(path, node.documentUrl);
        this.addKeyValue('Resolves to', this.link(url, `${url} (data, not an RFC-8 document)`));
      } catch (err) {
        this.addKeyValue('Resolves to', `error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private showTraits(omeNode: OmeNode) {
    const traits = omeNode.traits ?? [];
    if (traits.length === 0) {
      this.addKeyValue('Traits', '-');
      return;
    }
    this.addTitle('Traits');
    for (const trait of traits) {
      const block = document.createElement('div');
      block.classList.add(`${CSS_CLASS_PREFIX}trait`);
      const heading = document.createElement('div');
      heading.classList.add(`${CSS_CLASS_PREFIX}trait-heading`);
      heading.appendChild(this.typeElement(trait.type));
      block.appendChild(heading);
      const summary = this.traitSummary(trait);
      if (summary) {
        block.appendChild(summary);
      }
      const details = document.createElement('details');
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = 'raw';
      details.appendChild(summaryEl);
      const { type, ...payload } = trait;
      void type;
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(payload, null, 2);
      details.appendChild(pre);
      block.appendChild(details);
      this.content.appendChild(block);
    }
  }

  /** Human-readable summary of the built-in traits; `null` for unknown ones. */
  private traitSummary(trait: Trait): HTMLElement | null {
    const p = document.createElement('p');
    switch (trait.type) {
      case 'well': {
        const well = trait as WellTrait;
        p.textContent = `row ${well.row_index}, column ${well.column_index}`;
        return p;
      }
      case 'plate': {
        const plate = trait as PlateTrait;
        const rows = (plate.rows ?? []).map((r) => r.name).join(', ');
        const columns = (plate.columns ?? []).map((c) => c.name).join(', ');
        p.textContent = `rows: ${rows || '-'}; columns: ${columns || '-'}; acquisitions: ${plate.acquisitions?.length ?? 0}`;
        return p;
      }
      case 'acquisition': {
        const acquisition = trait as AcquisitionTrait;
        p.textContent = 'acquisition: ';
        p.appendChild(this.referenceElement(acquisition.acquisition));
        return p;
      }
      case 'labels': {
        const labels = trait as LabelsTrait;
        if (labels.source && labels.source.length > 0) {
          p.appendChild(document.createTextNode('source: '));
          labels.source.forEach((ref, index) => {
            if (index > 0) p.appendChild(document.createTextNode(', '));
            p.appendChild(this.referenceElement(ref));
          });
          p.appendChild(document.createElement('br'));
        }
        for (const label of labels.label_attributes ?? []) {
          const swatch = document.createElement('span');
          swatch.classList.add(`${CSS_CLASS_PREFIX}swatch`);
          if (label.rgba && label.rgba.length >= 3) {
            const [r, g, b, a = 255] = label.rgba;
            swatch.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          }
          swatch.title = `rgba: ${JSON.stringify(label.rgba ?? null)}`;
          p.appendChild(swatch);
          p.appendChild(document.createTextNode(` ${label.label_value} `));
        }
        return p;
      }
      case 'scene': {
        const scene = trait as SceneTrait;
        p.textContent = `${scene.coordinate_systems?.length ?? 0} coordinate system(s), ${scene.coordinate_transformations?.length ?? 0} transformation(s)`;
        return p;
      }
      default:
        return null;
    }
  }

  private showCoordinateSystems(omeNode: OmeNode) {
    const systems = omeNode.coordinate_systems ?? [];
    this.addTitle('Coordinate systems');
    const list = document.createElement('ul');
    for (const cs of systems) {
      const item = document.createElement('li');
      const axes = cs.axes
        .map(
          (axis) =>
            `${axis.name}${axis.type || axis.unit ? ` (${[axis.type, axis.unit].filter(Boolean).join(', ')})` : ''}`
        )
        .join(', ');
      item.textContent = `${cs.name ? `${cs.name} ` : ''}[${cs.id}]: ${axes}`;
      list.appendChild(item);
    }
    this.content.appendChild(list);
  }

  private showScales(node: D3Node) {
    const scales = node.omeNode.scales ?? [];
    this.addTitle('Scales');
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const title of ['#', 'href', 'format', 'scale', 'translation', 'id']) {
      const th = document.createElement('th');
      th.textContent = title;
      header.appendChild(th);
    }
    const body = table.createTBody();
    const documentUrl = node.targetUrl ?? node.documentUrl;
    scales.forEach((scale, index) => {
      const row = body.insertRow();
      const scaleTransform = scale.coordinate_transformations?.find((t) => t.type === 'scale');
      const translation = scale.coordinate_transformations?.find((t) => t.type === 'translation');
      row.insertCell().textContent = String(index);
      const hrefCell = row.insertCell();
      try {
        hrefCell.appendChild(this.link(resolveHref(scale.path, documentUrl), scale.path.href));
      } catch {
        hrefCell.textContent = scale.path.href;
      }
      row.insertCell().textContent = scale.path.format;
      row.insertCell().textContent = scaleTransform?.scale
        ? JSON.stringify(scaleTransform.scale)
        : '-';
      row.insertCell().textContent = translation?.translation
        ? JSON.stringify(translation.translation)
        : '-';
      const idCell = row.insertCell();
      idCell.textContent = scale.id.slice(0, 8);
      idCell.title = scale.id;
    });
    this.content.appendChild(table);
  }

  private showFields(omeNode: OmeNode) {
    const fields = nodeFields(omeNode);
    if (Object.keys(fields).length === 0) {
      return;
    }
    this.addTitle('Fields');
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(fields, null, 2);
    this.content.appendChild(pre);
  }

  private showManifest(manifest: ExtensionManifestEntry[]) {
    this.addTitle('Extension manifest');
    const list = document.createElement('ul');
    for (const entry of manifest) {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = `${entry.name ?? entry.id} (version ${entry.version})`;
      item.appendChild(name);
      if (entry.must_understand) {
        const badge = document.createElement('span');
        badge.classList.add(`${CSS_CLASS_PREFIX}trait-badge`);
        badge.textContent = 'must understand';
        item.appendChild(badge);
      }
      item.appendChild(document.createElement('br'));
      item.appendChild(this.link(entry.homepage ?? entry.id, entry.id));
      for (const schema of entry.schemas ?? []) {
        item.appendChild(document.createElement('br'));
        item.appendChild(this.link(schema.url, `${schema.type}: ${schema.url}`));
      }
      if (entry.description) {
        item.appendChild(document.createElement('br'));
        item.appendChild(document.createTextNode(entry.description));
      }
      list.appendChild(item);
    }
    this.content.appendChild(list);
  }

  private showValidation() {
    this.element.classList.remove(`${CSS_CLASS_PREFIX}has-error`);
    const notice = document.createElement('div');
    notice.classList.add(`${CSS_CLASS_PREFIX}alert`, `${CSS_CLASS_PREFIX}warning`);
    notice.textContent = VALIDATION_UNAVAILABLE_MESSAGE;
    this.content.prepend(notice);
  }

  /** A type label: keywords as text, URI types as a link to their extension (short name shown). */
  private typeElement(type: string): HTMLElement {
    const span = document.createElement('span');
    if (!isExtensionType(type)) {
      span.textContent = type;
      return span;
    }
    const entry = this.graph.findManifestEntry(type);
    const href = entry?.homepage ?? entry?.schemas?.[0]?.url ?? type;
    const link = this.link(href, shortTypeName(type, entry ? [entry] : undefined));
    link.title = entry
      ? `${type}\nextension: ${entry.name ?? entry.id} (version ${entry.version})`
      : `${type}\nnot declared in any extension_manifest`;
    span.appendChild(link);
    span.appendChild(document.createTextNode(` (${type})`));
    return span;
  }

  private referenceElement(ref: OmeReference | undefined): HTMLElement {
    const span = document.createElement('span');
    if (!ref) {
      span.textContent = '-';
      return span;
    }
    span.textContent = `${ref.type} ${ref.ref}`;
    if (ref.path) {
      span.textContent += ` in ${ref.path.href}`;
    }
    const target = this.graph.findNodeByOmeId(ref.ref);
    if (target) {
      span.title = `node "${displayName(target.omeNode)}"`;
    }
    return span;
  }

  private link(href: string, text: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = text;
    return a;
  }

  private addTitle(value: string) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = value;
    p.appendChild(title);
    this.content.appendChild(p);
  }

  private addKeyValue(key: string, value: string | HTMLElement) {
    const p = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = `${key}: `;
    p.appendChild(title);
    if (typeof value === 'string') {
      const text = document.createElement('span');
      text.textContent = value || '-';
      p.appendChild(text);
    } else {
      p.appendChild(value);
    }
    this.content.appendChild(p);
  }

  hide() {
    this.element.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }

  isOpen() {
    return !this.element.classList.contains(`${CSS_CLASS_PREFIX}hide`);
  }
}
