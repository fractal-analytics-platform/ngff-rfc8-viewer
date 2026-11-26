import { CSS_CLASS_PREFIX } from './constants';

type AlertOptions = { type: 'error' | 'warning'; fixed: boolean; dismissable: boolean };

export class NGFFAlert {
  private element: HTMLDivElement;
  private options: AlertOptions;
  private message: string = '';

  constructor(options: Partial<AlertOptions> = {}) {
    this.element = document.createElement('div');
    this.options = { type: 'error', fixed: false, dismissable: false, ...options };
    this.element.classList.add(
      `${CSS_CLASS_PREFIX}alert`,
      `${CSS_CLASS_PREFIX}${this.options.type}`,
      `${CSS_CLASS_PREFIX}hide`
    );
    if (this.options.fixed) {
      this.element.classList.add(`${CSS_CLASS_PREFIX}alert-fixed`);
    }
  }

  public render(): HTMLElement {
    return this.element;
  }

  public signalError(err: unknown) {
    if (err) {
      console.trace(err); // to enable debugging of where the error originated
      this.message =
        typeof err === 'string' ? err : err instanceof Error ? err.message : 'Unexpected error';
      this.showMessage();
    } else {
      this.message = '';
      this.hideMessage();
    }
  }

  private showMessage() {
    this.element.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = this.message;
    this.element.appendChild(span);
    if (this.options.dismissable) {
      const button = document.createElement('button');
      button.innerHTML = '&times;';
      button.onclick = () => this.hideMessage();
      this.element.appendChild(button);
    }
    this.element.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  private hideMessage() {
    this.element.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }

  public getMessage() {
    return this.message;
  }
}
