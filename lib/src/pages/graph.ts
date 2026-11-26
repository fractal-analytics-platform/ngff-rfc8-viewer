import { NGFFAlert } from '../alert';
import { CSS_CLASS_PREFIX } from '../constants';
import NGFFControlPanel from '../control';
import { NGFFGraph } from '../graph';
import { NGFFResolver } from '../resolver';
import { NGFFSidebar } from '../sidebar';
import type { D3Node } from '../types';
import type NGFFViewer from '../viewer';
import type { NGFFView } from '../views/base';
import { ImagesView } from '../views/images';
import { ListView } from '../views/list';
import { TreeView } from '../views/tree';

type ViewType = 'tree' | 'images' | 'list';

export class NGFFGraphPage {
  private viewer: NGFFViewer;
  private graph: NGFFGraph;
  private controlPanel: NGFFControlPanel;
  private sidebar: NGFFSidebar;
  private view: NGFFView | null = null;
  private viewContainer: HTMLElement;
  private errorAlert: NGFFAlert;
  private validation: boolean = false;

  constructor(viewer: NGFFViewer, source: string, autoloadDepth: number, validate: boolean) {
    this.viewer = viewer;
    this.validation = validate;

    const resolver = new NGFFResolver(source);
    this.graph = new NGFFGraph(this, resolver, autoloadDepth);

    this.controlPanel = new NGFFControlPanel(viewer, this);
    this.sidebar = new NGFFSidebar(this, this.graph, resolver);

    this.viewContainer = document.createElement('div');
    this.errorAlert = new NGFFAlert();
  }

  public render(): HTMLElement {
    const root = document.createElement('div');
    root.classList.add(`${CSS_CLASS_PREFIX}container`);

    const graphContainer = document.createElement('div');
    graphContainer.classList.add(`${CSS_CLASS_PREFIX}graph-container`);

    graphContainer.append(this.controlPanel.render());

    this.viewContainer.classList.add(`${CSS_CLASS_PREFIX}view-container`);
    graphContainer.append(this.viewContainer);

    root.appendChild(graphContainer);

    this.signalLoading(true);
    this.graph
      .loadRoot()
      .then(async () => {
        const params = new URLSearchParams(window.location.search);
        this.setView((params.get('view') as ViewType) || 'tree', false);
        root.appendChild(this.sidebar.render());
        const node = await this.loadSelectedPath();
        this.view?.render();
        this.view?.selectNode(node);
        this.signalLoading(false);
      })
      .catch((err) => {
        this.displayRootError(err);
      });

    return root;
  }

  public async setView(view: ViewType, render = true) {
    if (!this.viewContainer) {
      return;
    }

    if (this.errorAlert.getMessage()) {
      return;
    }

    this.viewContainer.innerHTML = '';

    if (this.view) {
      this.view.destroy();
    }

    switch (view) {
      case 'list':
        this.view = new ListView(this.graph, this.viewContainer);
        break;
      case 'images':
        this.view = new ImagesView(this.graph, this.viewContainer);
        break;
      default:
        this.view = new TreeView(this.graph, this.viewContainer);
        break;
    }

    if (render) {
      this.view.render();
    }
  }

  private async loadSelectedPath(): Promise<D3Node | undefined> {
    const params = new URLSearchParams(window.location.search);
    const selectedPath = params.get('select');
    if (selectedPath) {
      console.log('Load path: %s', selectedPath);
      try {
        const node = await this.graph.loadNodeAtPath(selectedPath);
        // setting collapsed because is then toggled when the node is selected
        node.collapsed = true;
        return node;
      } catch (err) {
        this.signalError(err);
      }
    } else {
      return undefined;
    }
  }

  public signalNodeSelected(node?: D3Node) {
    this.sidebar.setNode(node);

    const params = new URLSearchParams(window.location.search);
    let idsToNode = '';
    if (node) {
      idsToNode = this.graph.getParentsIds(node).join('/');
    }
    if (idsToNode !== params.get('select')) {
      params.set('select', idsToNode);
      history.pushState(null, '', `?${params.toString()}`);
    }
  }

  public setValidation(validate: boolean) {
    this.validation = validate;
    this.sidebar.refresh();
  }

  public getValidation(): boolean {
    return this.validation;
  }

  public signalLoading(loading: boolean) {
    this.controlPanel.setLoadingState(loading);
  }

  public signalError(err: unknown) {
    this.viewer.signalError(err);
  }

  public async recursiveLoad(autoloadDepth: number) {
    if (!this.view) {
      return;
    }

    await this.graph.recursiveLoad(autoloadDepth);
    this.view.render();
  }

  public async backToRoot() {
    this.view?.selectNode();
    try {
      await this.graph.loadRoot();
      this.view?.render();
    } catch (err) {
      this.displayRootError(err);
    }
  }

  private displayRootError(err: unknown) {
    this.viewContainer.innerHTML = '';
    this.viewContainer.appendChild(this.errorAlert.render());
    this.errorAlert.signalError(err);
  }
}
