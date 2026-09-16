import { buildNetworkGraph } from './graph';
import { loadGraphData } from './loader';

const CSS_CLASS_PREFIX = 'ngff-rfc8-viewer-';

export default class NGFFViewer {
  constructor(elementId: string, source: string | null) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Unable to find element with id ${elementId}`);
      return;
    }

    this.load(elementId, source);
  }

  async load(elementId: string, source: string | null) {
    if (!source) {
      this.showAlert(elementId, 'Missing source parameter', 'warning');
      return;
    }

    try {
      const data = await loadGraphData(source);
      buildNetworkGraph(data, elementId);
    } catch (err) {
      console.error(err);
      const error = err instanceof Error ? err.message : 'Unexpected error';
      this.showAlert(elementId, error, 'error');
    }
  }

  showAlert(elementId: string, message: string, type: 'warning' | 'error') {
    const alert = document.createElement('div');
    alert.classList.add(`${CSS_CLASS_PREFIX}alert`);
    alert.classList.add(`${CSS_CLASS_PREFIX}${type}`);
    alert.classList.remove(`${CSS_CLASS_PREFIX}hide`);
    alert.innerText = message;
    document.getElementById(elementId)?.appendChild(alert);
  }
}
