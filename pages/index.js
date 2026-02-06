/**
 * Switchboard Overlay Service - Home Page
 */

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🎨 Switchboard Image Overlay Service</h1>
      <p>Self-hosted image overlay API for product covers</p>

      <h2>API Endpoint</h2>
      <code style={{ background: '#f4f4f4', padding: '0.5rem', display: 'block' }}>
        POST /api/overlay
      </code>

      <h2>Request Example</h2>
      <pre style={{ background: '#f4f4f4', padding: '1rem', overflow: 'auto' }}>
{`{
  "template": "product-cover",
  "sizes": [{ "width": 1080, "height": 1080 }],
  "elements": {
    "product-image": { "url": "https://example.com/product.jpg" },
    "stt-cover": { "url": "https://example.com/overlay.png" },
    "product-title": { "text": "Product Title" }
  }
}`}
      </pre>

      <h2>Response</h2>
      <p>Returns processed PNG image directly with <code>Content-Type: image/png</code></p>

      <h2>Status</h2>
      <p>✅ Service is running</p>

      <h2>Features</h2>
      <ul>
        <li>✅ Fast image processing with Sharp</li>
        <li>✅ Auto-resize to target dimensions</li>
        <li>✅ Overlay composition</li>
        <li>✅ Temporary URL serving (no storage)</li>
        <li>✅ CORS enabled for cross-origin requests</li>
      </ul>
    </div>
  );
}
