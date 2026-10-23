import type { OmeNode } from './types';
import { validateRequiredOmeStructure } from './validation';

export class UntrustedDomainError extends Error {
  domain: string;
  constructor(domain: string) {
    super(`The domain ${domain} is not trusted`);
    this.domain = domain;
  }
}

export class NGFFLoader {
  private source: string;
  private prefix: string;
  private trustedDomains: string[] = [];

  constructor(source: string) {
    this.source = source;
    if (!this.source.endsWith('.json')) {
      this.source += 'zarr.json';
    }

    this.prefix = this.source.endsWith('.json')
      ? this.source.substring(0, this.source.search(/\/[^/]+\.json$/))
      : this.source;

    const url = this.checkUrl(this.source);
    this.addTrustedDomain(url.hostname);
  }

  getPrefix() {
    return this.prefix;
  }

  async loadGraphData(): Promise<OmeNode> {
    return await this.loadNode(this.source);
  }

  async loadNode(source: string): Promise<OmeNode> {
    if (source.startsWith('./')) {
      source = `${this.prefix}${source.substring(1)}`;
    } else {
      const url = this.checkUrl(source);
      if (!this.trustedDomains.includes(url.hostname)) {
        throw new UntrustedDomainError(url.hostname);
      }
    }
    const response = await fetch(source, {
      mode: 'cors',
      cache: 'no-cache'
    });
    if (response.ok) {
      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Unable to load ${source}: invalid JSON content`);
      }
      const ome = this.getOme(data);
      validateRequiredOmeStructure(ome);
      return ome;
    } else {
      throw new Error(
        `Unexpected response from server while loading ${source}. Status: ${response.status}`
      );
    }
  }

  addTrustedDomain(domain: string) {
    this.trustedDomains.push(domain);
  }

  private checkUrl(source: string) {
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw new Error(`Source is not a valid URL`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Protocol ${url.protocol} is not supported`);
    }

    return url;
  }

  private getOme(data: any): OmeNode {
    if ('ome' in data) {
      return data.ome;
    } else if ('attributes' in data && 'ome' in data.attributes) {
      return data.attributes.ome;
    }
    throw new Error('Payload does not contain ome field');
  }
}
