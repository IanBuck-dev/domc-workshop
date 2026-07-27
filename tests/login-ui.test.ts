import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../apps/web/src/components/ui/button.tsx";
import { LoginPage } from "../apps/web/src/pages/login-page.tsx";

describe("login UI", () => {
  test("der sichtbare Anmelden-Button sendet das Formular ab", () => {
    const markup = renderToStaticMarkup(
      createElement(LoginPage, { onLogin: () => undefined }),
    );

    expect(markup).toContain("<form");
    expect(markup).toContain('type="submit"');
    expect(markup).toContain("Anmelden</button>");
  });

  test("allgemeine Buttons lösen ohne expliziten Typ kein Formular aus", () => {
    const markup = renderToStaticMarkup(createElement(Button, null, "Aktion"));
    expect(markup).toContain('type="button"');
  });
});
