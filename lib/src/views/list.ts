import * as d3 from 'd3';
import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX } from './../constants';
import type { NGFFGraph } from './../graph';

const colors: Record<string, string> = {
  collection: '#4f81bd',
  multiscale: '#9bbb59',
  singlescale: '#c0504d'
};

const defaultNodeColor = '#999';
const selectionStrokeColor = '#333';
const inliningStrokeColor = '#8e009b';

const nodeSpacing = 160;
const circleRadius = 24;
const arrowSize = 20;

export class ListGraph {
  private graph: NGFFGraph;
  private containerId: string;
  private rootElement: HTMLDivElement;
  
  private nodeSelectHandler: (node: D3Node) => void = () => {};
  private backgroundClickHandler: () => void = () => {};

  constructor(graph: NGFFGraph, containerId: string) {
    console.log("Initializing ListGraph with containerId:", containerId);
    this.graph = graph;

    this.containerId = containerId;

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add(`${CSS_CLASS_PREFIX}list-graph-root`);
    this.rootElement.innerHTML = '<h1>Graph</h1>';
    // document.getElementById(this.containerId)!.innerHTML = '';
    document.getElementById(this.containerId)?.appendChild(this.rootElement);

    graph.onChange(() => this.renderTree());
  }

  onNodeSelect(fn: (node: D3Node) => void) {
    this.nodeSelectHandler = fn;
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
    const isCollapsed = node.collapsed || !isLoaded;
    const hasChildren = ["multiscale", "collection"].includes(node.omeNode.type);
    const nodeElement = document.createElement('div');
    
    let parentId = parent?.omeNode?.id;
    if (parentId) {
      nodeElement.setAttribute('data-parent-id', parentId);
    }
    nodeElement.title = `ID: ${node.omeNode.id}\nparentId: ${parentId ?? 'none'}`;
    nodeElement.id = `node-${node.omeNode.id}`;
    nodeElement.className = `node-element ${isCollapsed ? 'collapsed' : ''} ${hasChildren ? 'has-children' : ''}`;
    
    // Add a button to load children and toggle the collapsed class of the node
    const button = document.createElement('button');
    button.textContent = `${node.omeNode?.name}`;
    nodeElement.appendChild(button);
    button.onclick = async () => {
      // Adding 'collapsed' class will hide child nodes etc.
      nodeElement.classList.toggle('collapsed');
      if (isLoaded) {
        // simply toggle collapsed - don't need to re-render the tree
        node.collapsed = !node.collapsed;
        return;
      }
      await this.graph.loadNodeWithSignal(
        node as D3Node & { omeNode: OmeNode & { path: OmePath } }
      );
      this.renderTree();
    };
    if (parentId) {
      document.getElementById(`node-${parentId}`)?.appendChild(nodeElement);
    } else {
      this.rootElement.appendChild(nodeElement);
    }
  }

  showErrorAlert(message: string) {
    this.errorAlert.selectAll('*').remove();
    this.errorAlert.append('span').text(message);
    this.errorAlert
      .append('button')
      .html('&times;')
      .on('click', () => this.hideErrorAlert());
    this.errorAlert.classed(`${CSS_CLASS_PREFIX}hide`, false);
  }

  hideErrorAlert() {
    this.errorAlert.classed(`${CSS_CLASS_PREFIX}hide`, true);
  }
}
