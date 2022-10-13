class MetaRewriter implements HTMLRewriterElementContentHandlers {
  element(element: Element) {}
}

class HeadRewriter implements HTMLRewriterElementContentHandlers {
  element(element: Element) {}
}

class BodyRewriter implements HTMLRewriterElementContentHandlers {
  public base: string
  constructor(public domain: string) {
    this.base = domain.split('.').slice(1).join('.')
  }
  element(element: Element) {
    element.append(
      `<script>
window.CONFIG.publicDomainName = '${this.base}';
</script>`,
      {
        html: true
      }
    )
  }
}

export async function transformHTML(res: Response, domain: string) {
  return new HTMLRewriter()
    .on('title', new MetaRewriter())
    .on('meta', new MetaRewriter())
    .on('head', new HeadRewriter())
    .on('body', new BodyRewriter(domain))
    .transform(res)
}
