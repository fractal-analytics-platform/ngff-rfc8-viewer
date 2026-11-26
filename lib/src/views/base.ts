import type { D3Node } from '../types';

export interface NGFFView {
  render(): void;
  selectNode(node?: D3Node): void;
  destroy(): void;
}
