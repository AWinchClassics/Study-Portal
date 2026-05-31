/**
 * PdfViewer
 *
 * Embeds a PDF inline using an iframe.
 * Works for Supabase Storage uploads and most publicly accessible PDF URLs.
 * An "Open in new tab" link is always shown in the resource header (ChunkPage)
 * as a fallback for PDFs that cannot be embedded due to server headers.
 */
export default function PdfViewer({ url, title }) {
  if (!url) return null

  return (
    <div className="pdf-viewer-wrap">
      <iframe
        src={url}
        title={title || 'PDF Document'}
        className="pdf-iframe"
      />
    </div>
  )
}
