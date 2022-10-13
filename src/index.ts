import MIMEType from 'whatwg-mimetype'
import { transformHTML } from './html'

export interface Env {
  UPSTREAM: string
}

const textualMimeTypes = [
  'application/javascript',
  'application/json',
  'application/xml',
  'text/css',
  'text/html',
  'text/plain'
]

function handleOptions(req: Request): Response {
  const { headers } = req
  const corsOrigin = headers.get('Origin')
  const corsMethod = headers.get('Access-Control-Request-Method')
  const corsHeaders = headers.get('Access-Control-Request-Headers')
  // TODO: check origin
  const allowedMethods = 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS'
  if (corsOrigin !== null && corsMethod !== null && corsHeaders !== null) {
    // Handle CORS pre-flight request.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': allowedMethods,
        'Access-Control-Allow-Headers': corsHeaders
      }
    })
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: allowedMethods
      }
    })
  }
}

function parseMIME(res: Response) {
  const header = res.headers.get('Content-Type')
  if (!header) return null
  try {
    return new MIMEType(header)
  } catch {
    return null
  }
}

async function rewrite(
  res: Response,
  domain: string,
  upstream: string
): Promise<Response> {
  const mime = parseMIME(res)
  const isTextual = mime && textualMimeTypes.includes(mime.essence)
  if (isTextual) {
    let body = await res.text()
    body = body.replaceAll(upstream, domain)
    res = new Response(body, res)
    if (mime.essence === 'text/html') {
      body = await transformHTML(res, domain).then((res) => res.text())
      res = new Response(body, res)
    }
    return res
  }
  return new Response(res.body, res)
}

async function proxy(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const upstream = env.UPSTREAM || 'thezzisu.notion.site'
  const corsOrigin = req.headers.get('Origin')
  const url = new URL(req.url)
  const domain = url.hostname
  url.hostname = upstream
  if (url.pathname === '/api/v3/getPublicPageData') {
    // Hack this request
    const payload = <any>await req.json()
    payload.spaceDomain = upstream.split('.')[0]
    req = new Request(req, { body: JSON.stringify(payload) })
  }
  let res = await fetch(url.toString(), req)
  res = await rewrite(res, domain, upstream)
  corsOrigin && res.headers.set('Access-Control-Allow-Origin', corsOrigin)
  return res
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (req.method === 'OPTIONS') return handleOptions(req)
    return proxy(req, env, ctx)
  }
}
