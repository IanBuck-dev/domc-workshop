import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicFooter } from "../apps/web/src/components/public-footer.tsx";

describe("public pages UI", () => {
  test("renders public legal and license links without an application session", () => {
    const markup = renderToStaticMarkup(createElement(PublicFooter));
    expect(markup).toContain('href="/impressum"');
    expect(markup).toContain('href="/datenschutz"');
    expect(markup).toContain('href="/nutzungshinweise"');
    expect(markup).toContain('href="/THIRD_PARTY_NOTICES.txt"');
    expect(markup).toContain("Open-Source-Lizenzen");
  });
});
