import * as Http from 'http';
import * as Https from 'https';
import { Stream } from 'pump';
import * as Undici from 'undici';

interface Options {
  base?: string;
  http2?: boolean;
  undici?: Undici.Pool.Options;
  cacheURLs?: number;
  requests?: {
    http?: Http.Agent,
    https?: Https.Agent
  };
  keepAliveMsecs?: number;
  maxSockets?: number;
  rejectUnauthorized?: boolean;
}

declare function fastProxy(options?: Options): {
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

export default fastProxy
