import type { OmeDocument } from './types';
import { detectLegacyFormat, validateRequiredOmeStructure } from './validation';
import { metaUrlForSource } from './paths';
import { normalizeDocument } from './normalize';

export class UntrustedDomainError extends Error {
  domain: string;
  constructor(domain: string) {
    super(`The domain ${domain} is not trusted`);
    this.domain = domain;
  }
}

export class NGFFLoader {
  private source: string;
  private trustedDomains: string[] = [];

  constructor(source: string) {
    this.source = metaUrlForSource(source);
    const url = this.checkUrl(this.source);
    this.addTrustedDomain(url.hostname);
  }

  /** Absolute URL of the root document's metadata file. */
  getSource() {
    return this.source;
  }

  async loadGraphData(): Promise<OmeDocument> {
    return await this.loadNode(this.source);
  }

  /** Fetches and checks the RFC-8 document at an absolute URL. */
  async loadNode(url: string): Promise<OmeDocument> {
    const parsedUrl = this.checkUrl(url);
    if (!this.trustedDomains.includes(parsedUrl.hostname)) {
      throw new UntrustedDomainError(parsedUrl.hostname);
    }
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache'
    });
    if (response.ok) {
      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Unable to load ${url}: invalid JSON content`);
      }
      return this.getOme(data);
    } else {
      throw new Error(
        `Unexpected response from server while loading ${url}. Status: ${response.status}`
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

  private getOme(data: any): OmeDocument {
    let raw: unknown;
    if ('ome' in data) {
      raw = data.ome;
    } else if ('attributes' in data && data.attributes && 'ome' in data.attributes) {
      raw = data.attributes.ome;
    } else {
      throw new Error('Payload does not contain ome field');
    }
    const ome = normalizeDocument(raw);
    detectLegacyFormat(ome);
    validateRequiredOmeStructure(ome);
    return ome as OmeDocument;
  }
}
