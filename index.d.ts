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
      onResponse?(req: _req, res: _res, stream: Stream): void;
      rewriteRequestHeaders?(req: _req, headers: { [key as string]: string }): { headers: { [key as string]: string } };
      rewriteHeaders?(headers: { [key as string]: string }): { headers: { [key as string]: string } };
      request?: Http.RequestOptions;
      queryString?: string;
    }
  ): void;
  close(): void;
}

export default fastProxy
