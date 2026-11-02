/** Minimal namespace-agnostic XML reader (elements, attributes, text, CDATA, predefined entities). No DTD/entity expansion. */
export type XNode = {
  name: string
  attrs: Record<string, string>
  children: XNode[]
  text: string
}

const MAX_NODES = 500_000

const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-fA-F]+);/g, (_, e: string) => {
    switch (e) {
      case 'lt':
        return '<'
      case 'gt':
        return '>'
      case 'quot':
        return '"'
      case 'apos':
        return "'"
      case 'amp':
        return '&'
      default:
        return String.fromCodePoint(e[1] === 'x' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)))
    }
  })

const local = (name: string) => name.slice(name.indexOf(':') + 1)

export function parseXml(src: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, children: [], text: '' }
  const stack: XNode[] = [root]
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g
  let count = 0
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    const top = stack[stack.length - 1] as XNode
    if (m[1] !== undefined) {
      top.text += m[1]
    } else if (m[6] !== undefined) {
      top.text += unescapeXml(m[6])
    } else if (m[3] !== undefined) {
      if (m[2] === '/') {
        if (stack.length > 1) stack.pop()
        continue
      }
      if (++count > MAX_NODES) throw new Error('XML too large')
      const attrs: Record<string, string> = {}
      for (const a of (m[4] ?? '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs[local(a[1] as string)] = unescapeXml((a[2] ?? a[3]) as string)
      }
      const node: XNode = { name: local(m[3]), attrs, children: [], text: '' }
      top.children.push(node)
      if (m[5] !== '/') stack.push(node)
    }
  }
  if (root.children.length === 0) throw new Error('No XML elements found')
  return root.children[0] as XNode
}

/** First descendant (depth-first) reached by following `a/b/c` child names; `*` is not supported. */
export function at(node: XNode | undefined, path: string): XNode | undefined {
  let cur = node
  for (const part of path.split('/')) {
    cur = cur?.children.find((c) => c.name === part)
    if (!cur) return undefined
  }
  return cur
}

export function all(node: XNode | undefined, name: string): XNode[] {
  return node?.children.filter((c) => c.name === name) ?? []
}

export function textAt(node: XNode | undefined, path: string): string | null {
  const t = at(node, path)?.text.trim()
  return t ? t : null
}

/** First element called `name` anywhere below `node`. */
export function find(node: XNode | undefined, name: string): XNode | undefined {
  if (!node) return undefined
  for (const c of node.children) {
    if (c.name === name) return c
    const deeper = find(c, name)
    if (deeper) return deeper
  }
  return undefined
}
