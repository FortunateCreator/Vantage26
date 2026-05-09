import fs from 'fs'
import path from 'path'

export default function HomePage() {
  /* Read the static HTML and inject it. The form posts to /api/leads. */
  const filePath = path.join(process.cwd(), 'app', 'storefront.html')
  let html = ''
  try {
    html = fs.readFileSync(filePath, 'utf8')
    /* Extract just the body content + style + script for inline injection */
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    if (bodyMatch && styleMatch) {
      return (
        <>
          <style dangerouslySetInnerHTML={{ __html: styleMatch[1] }} />
          <div dangerouslySetInnerHTML={{ __html: bodyMatch[1] }} />
        </>
      )
    }
  } catch (err) {
    console.error('Failed to load storefront.html:', err)
  }
  return <div>Storefront loading…</div>
}
