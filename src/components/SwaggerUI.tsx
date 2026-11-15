"use client";

import { useRef } from "react";
import Script from "next/script";

// Swagger UI is loaded from a pinned version on the CDN (no npm package, US-12 #18).
const SWAGGER_UI_BASE = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

type SwaggerUIBundle = (options: { url: string; domNode: HTMLElement }) => unknown;

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundle;
  }
}

/** Interactive API reference that reads the spec from /openapi.json. */
export default function SwaggerUI() {
  const containerRef = useRef<HTMLDivElement>(null);

  // onReady runs after the bundle loads, or at once when it is already loaded.
  function startSwaggerUI() {
    const container = containerRef.current;
    if (!container || !window.SwaggerUIBundle) return;
    window.SwaggerUIBundle({ url: "/openapi.json", domNode: container });
  }

  return (
    <>
      <link rel="stylesheet" href={`${SWAGGER_UI_BASE}/swagger-ui.css`} />
      <div
        ref={containerRef}
        id="swagger-ui"
        role="region"
        aria-label="Interactive API reference"
        className="rounded-lg border border-rule bg-surface p-2"
      >
        <noscript>
          <p className="p-4 text-sm text-ink-2">
            The interactive reference needs JavaScript. The raw spec is at{" "}
            <a href="/openapi.json" className="font-medium text-edit underline">
              /openapi.json
            </a>
            .
          </p>
        </noscript>
      </div>
      <Script
        src={`${SWAGGER_UI_BASE}/swagger-ui-bundle.js`}
        strategy="afterInteractive"
        onReady={startSwaggerUI}
      />
    </>
  );
}
