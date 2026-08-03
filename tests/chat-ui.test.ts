import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("chat capture UI contract", () => {
  test("defaults setup to Chat and preserves the Form alternative", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-start-page.tsx"),
      "utf8",
    );
    expect(source).toContain('useState<"chat" | "form">');
    expect(source).toContain('"chat",');
    expect(source).toContain("Empfohlen");
    expect(source).toContain("Formular");
  });

  test("contains the deterministic tutorial and blocking document actions", async () => {
    const tutorial = await readFile(
      join(process.cwd(), "apps/web/src/components/chat-capture-tutorial.tsx"),
      "utf8",
    );
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    expect(tutorial).toContain("Unterlagen bereitstellen");
    expect(tutorial).toContain("In Alltagssprache ergänzen");
    expect(tutorial).toContain("Prozessbild prüfen");
    expect(page).toContain("Unterlagen auswerten");
    expect(page).toContain("Ohne Unterlagen fortfahren");
    expect(page).toContain("Trotz offener Punkte bestätigen?");
    expect(page).toContain("useChat");
    expect(page).toContain("DefaultChatTransport");
  });

  test("uses controlled manual-activation tabs for the responsive chat views", async () => {
    const tabs = await readFile(
      join(process.cwd(), "apps/web/src/components/ui/tabs.tsx"),
      "utf8",
    );
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    expect(tabs).toContain('import { Tabs as TabsPrimitive } from "radix-ui"');
    expect(tabs).toContain("TabsPrimitive.Root");
    expect(tabs).toContain("TabsPrimitive.List");
    expect(tabs).toContain("TabsPrimitive.Trigger");
    expect(tabs).toContain("TabsPrimitive.Content");
    expect(page).toContain("value={tab}");
    expect(page).toContain('activationMode="manual"');
    expect(page).toContain(
      '<TabsList className="mb-3 grid h-10 w-full grid-cols-2 lg:hidden">',
    );
    expect(page).toContain('<TabsTrigger value="chat">Gespräch</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="diagram">');
    expect(page).toContain('aria-hidden="true" className="w-2 text-center"');
    expect(page).toContain('if (value === "diagram") setDiagramUnread(false);');
    expect(page).toContain("forceMount={desktopLayout || undefined}");
    expect(page).toContain("data-[state=inactive]:hidden");
    expect(page).toContain("lg:data-[state=inactive]:block");
    expect(page).toContain("window.matchMedia(desktopLayoutQuery)");
  });

  test("renders a read-only vertical React Flow with directional transitions and mentions", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/components/process-flow-diagram.tsx"),
      "utf8",
    );
    expect(source).toContain("nodesDraggable={false}");
    expect(source).toContain("nodesConnectable={false}");
    expect(source).toContain("h-48 w-64 overflow-hidden");
    expect(source).toContain(
      'className="line-clamp-3 font-semibold leading-snug"',
    );
    expect(source).toContain(
      'className="mt-1 line-clamp-3 text-sm text-muted-foreground"',
    );
    expect(source).toContain("title={value.name}");
    expect(source).toContain("title={value.activity}");
    expect(source).toContain("position: { x: 80, y: index * 240 }");
    expect(source).toContain("position={Position.Top}");
    expect(source).toContain("position={Position.Bottom}");
    expect(source).toContain("MarkerType.ArrowClosed");
    expect(source).toContain('color: "var(--muted-foreground)"');
    expect(source).toContain('position="top-right"');
    expect(source).toContain('className="!right-3 !top-3"');
    expect(source).toContain("Übergang-");
    expect(source).toContain("Schritt-");
    expect(source).toContain("onMention");
  });
});
