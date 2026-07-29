import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicFooter } from "../apps/web/src/components/public-footer.tsx";

describe("public pages UI", () => {
  test("renders the three public legal links without an application session", () => {
    const markup = renderToStaticMarkup(createElement(PublicFooter));
    expect(markup).toContain('href="/impressum"');
    expect(markup).toContain('href="/datenschutz"');
    expect(markup).toContain('href="/nutzungshinweise"');
  });
});
