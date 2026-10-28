import type { D3Node } from './../types';
import { CSS_CLASS_PREFIX, getNodeColor } from './../constants';
import type { NGFFGraph } from './../graph';
import { displayName, shortTypeName } from './../nodes';

export class ListView {
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
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
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

    const descendants = this.graph.getHierarchy().descendants();
    descendants.forEach((d) => {
      // this renders parent Nodes first, adding each to the DOM.
      // When child nodes are rendered, they are added as children to their respective parent nodes in the DOM.
      this.renderNode(d.data, d.parent?.data);
    });
  }

  renderNode(node: D3Node, parent: D3Node | undefined) {
    const isLoaded = node.loaded;
    const isRemote = node.omeNode.path !== undefined;
    const isCollapsed = node.collapsed || !isLoaded;
    // multiscales are leaves: their scales are metadata, not child nodes
    const hasChildren = node.omeNode.type === 'collection';
    const nodeElement = document.createElement('div');

    const parentId = parent ? parent.id : null;
    nodeElement.title = `ID: ${node.id}\nparentId: ${parentId ?? 'none'}`;
    nodeElement.id = `node-${node.id}`;
    nodeElement.style.opacity = isLoaded ? '1' : '0.5';
    nodeElement.style.paddingTop = isRemote ? '10px' : '2px';
    nodeElement.style.paddingBottom = isRemote ? '10px' : '2px';
    nodeElement.className = `${CSS_CLASS_PREFIX}node-element ${isCollapsed ? `${CSS_CLASS_PREFIX}collapsed` : ''} ${hasChildren ? `${CSS_CLASS_PREFIX}has-children` : ''}`;

    // Add a button to load children and toggle the collapsed class of the node
    const button = document.createElement('button');
    button.style.borderColor = getNodeColor(node.omeNode.type);
    button.textContent = displayName(node.omeNode);
    for (const trait of node.omeNode.traits ?? []) {
      const badge = document.createElement('span');
      badge.classList.add(`${CSS_CLASS_PREFIX}trait-badge`);
      const entry = this.graph.findManifestEntry(trait.type);
      badge.textContent = shortTypeName(trait.type, entry ? [entry] : undefined);
      badge.title = trait.type;
      button.appendChild(badge);
    }
    nodeElement.appendChild(button);
    button.onclick = async () => {
      this.selectNode(node);
      // Adding 'collapsed' class will hide child nodes etc.
      nodeElement.classList.toggle(`${CSS_CLASS_PREFIX}collapsed`);
      if (isLoaded) {
        // simply toggle collapsed - don't need to re-render the tree
        node.collapsed = !node.collapsed;
        return;
      }
      await this.graph.loadNodeWithSignal(node);
      this.renderTree();
    };
    if (parentId) {
      document.getElementById(`node-${parentId}`)?.appendChild(nodeElement);
    } else {
      this.rootElement.appendChild(nodeElement);
    }
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
