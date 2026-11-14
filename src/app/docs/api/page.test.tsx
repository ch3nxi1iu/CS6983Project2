// Tests for /docs/api (US-12, #18). Swagger UI is loaded from a pinned CDN
// file. jsdom does not fetch scripts, so the test fires the script's load event
// itself, which runs the real onLoad code that starts Swagger UI.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import DocsApiPage from "@/app/docs/api/page";

const BUNDLE_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
const STYLE_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css";

afterEach(() => {
  cleanup();
  delete (window as Window & { SwaggerUIBundle?: unknown }).SwaggerUIBundle;
});

describe("/docs/api", () => {
  test("has a Public API heading and a paragraph that explains the Bearer header", () => {
    render(<DocsApiPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Public API" })).toBeInTheDocument();
    expect(screen.getByText(/Authorization: Bearer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "API keys" })).toHaveAttribute("href", "/settings/api");
  });

  test("loads the pinned Swagger UI stylesheet and bundle from the CDN", async () => {
    render(<DocsApiPage />);

    expect(document.querySelector(`link[href="${STYLE_URL}"]`)).not.toBeNull();
    await waitFor(() => {
      expect(document.querySelector(`script[src="${BUNDLE_URL}"]`)).not.toBeNull();
    });
  });

  test("starts Swagger UI on /openapi.json once the bundle has loaded", async () => {
    const swaggerUIBundle = vi.fn();
    Object.assign(window, { SwaggerUIBundle: swaggerUIBundle });

    render(<DocsApiPage />);
    const script = await waitFor(() => {
      const element = document.querySelector<HTMLScriptElement>(`script[src="${BUNDLE_URL}"]`);
      expect(element).not.toBeNull();
      return element as HTMLScriptElement;
    });
    script.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(swaggerUIBundle).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/openapi.json" }),
      );
    });
  });
});
