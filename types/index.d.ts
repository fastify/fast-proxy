import * as Http from 'http';
import * as Https from 'https';
import * as Undici from 'undici';

type Stream = ReadableStream | WritableStream

type FastProxy = (options?: fastProxy.FastProxyOptions) => {
  proxy(
    originReq: Http.IncomingMessage,
    originRes: Http.ServerResponse,
    source: string,
    opts?: {
      base?: string;
      onResponse?(req: Http.IncomingMessage, res: Http.ServerResponse, stream: Stream): void;
      rewriteRequestHeaders?(req: Http.IncomingMessage, headers: Http.IncomingHttpHeaders): Http.IncomingHttpHeaders;
      rewriteHeaders?(headers: Http.OutgoingHttpHeaders): Http.OutgoingHttpHeaders;
      request?: Http.RequestOptions;
      queryString?: string;
    }
  ): void;
  close(): void;
}

declare namespace fastProxy {
  interface QueryStringModule {
    stringify(value: any): string;
    parse(value: string): any;
  }

  export interface FastProxyOptions {
    base?: string;
    http2?: boolean;
    undici?: true | Undici.Pool.Options;
    cacheURLs?: number;
    requests?: {
      http?: Http.Agent,
      https?: Https.Agent
    };
    keepAliveMsecs?: number;
    maxSockets?: number;
    rejectUnauthorized?: boolean;
    queryString?: QueryStringModule;
  }

  export const fastProxy: FastProxy
  export { fastProxy as default }
}

declare function fastProxy(...params: Parameters<FastProxy>): ReturnType<FastProxy>
export = fastProxy
