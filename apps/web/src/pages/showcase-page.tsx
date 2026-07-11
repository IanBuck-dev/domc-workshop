import {
  ArrowLeft,
  Bot,
  Clock3,
  Coins,
  FileCode2,
  Gauge,
  Globe2,
  MessageSquareText,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  finalResponses,
  researchPrompt,
  sessionFacts,
  userPrompts,
} from "../lib/showcase-data";

const nf = new Intl.NumberFormat("de-DE");
export function ShowcasePage() {
  const cacheShare =
    Math.round(
      (sessionFacts.cachedInputTokens / sessionFacts.inputTokens) * 1000,
    ) / 10;
  return (
    <>
      <Link className="back" to="/settings">
        <ArrowLeft />
        Zurück zu den Einstellungen
      </Link>
      <section className="showcase-header">
        <div>
          <h1>
            Von der Idee zum
            <br />
            lauffähigen Prototyp.
          </h1>
          <p>Auftrag, Umsetzung und Ergebnis bis zum verifizierten Build.</p>
        </div>
        <div className="showcase-time">
          <Clock3 />
          <b>{sessionFacts.elapsed}</b>
          <span>Erster Prompt bis verifizierter Build</span>
        </div>
      </section>

      <section
        className="showcase-metrics"
        aria-label="Gemessene Sitzungswerte"
      >
        <article>
          <MessageSquareText />
          <span>Dialog</span>
          <b>{userPrompts.length} Prompts</b>
          <small>vor Erstellung dieser Seite</small>
        </article>
        <article>
          <Gauge />
          <span>Token gesamt</span>
          <b>{nf.format(sessionFacts.totalTokens)}</b>
          <small>{cacheShare}% Eingabe aus dem Cache</small>
        </article>
        <article>
          <Coins />
          <span>API-Äquivalent</span>
          <b>ca. ${sessionFacts.estimatedUsd.toFixed(2)}</b>
          <small>Schätzung, keine Codex-Rechnung</small>
        </article>
        <article>
          <FileCode2 />
          <span>Ergebnis</span>
          <b>6 Ansichten · 2 Builds</b>
          <small>Mac und Windows x64</small>
        </article>
      </section>

      <div className="showcase-note">
        <b>Messpunkt:</b> lokale Codex-Sitzung <code>{sessionFacts.id}</code>,
        unmittelbar vor dem Auftrag für diese Seite. Die zwei nachfolgenden
        Änderungswünsche sind nicht enthalten. Die Preisschätzung nutzt
        öffentliche GPT-5.6-Sol-API-Raten; eine tatsächliche
        Codex-Pro-Einzelabrechnung enthält die Sitzungsdatei nicht.
      </div>

      <section
        className="build-timeline"
        aria-label="Prompt- und Ergebnis-Timeline"
      >
        {userPrompts.map((p, n) => (
          <div className="timeline-row" key={p.title}>
            <div className="timeline-marker">
              <span>{String(n + 1).padStart(2, "0")}</span>
            </div>
            <details open={n === 0}>
              <summary>
                <b>{p.title}</b>
                <small>Nutzer-Prompt</small>
              </summary>
              <pre>{p.text}</pre>
            </details>
          </div>
        ))}

        <div className="timeline-row research-row">
          <div className="timeline-marker">
            <Globe2 />
          </div>
          <article>
            <header>
              <div>
                <b>DOMCURA-Projektrecherche</b>
                <small>Separater Recherchelauf</small>
              </div>
              <div className="model-tags">
                <span>{researchPrompt.model}</span>
                <span>{researchPrompt.effort}</span>
                <span>{researchPrompt.capability}</span>
              </div>
            </header>
            <div className="timeline-columns">
              <div>
                <small>Prompt</small>
                <p>{researchPrompt.text}</p>
              </div>
              <div>
                <small>Ergebnis</small>
                <p>{researchPrompt.response}</p>
              </div>
            </div>
          </article>
        </div>

        {finalResponses.map((r, n) => (
          <div className="timeline-row response-row" key={r.title}>
            <div className="timeline-marker">
              <Bot />
            </div>
            <article>
              <header>
                <b>{r.title}</b>
                <small>Agent-Antwort {n + 1}</small>
              </header>
              <p>{r.text}</p>
            </article>
          </div>
        ))}
      </section>

      <section className="token-detail">
        <h2>Berechnungsgrundlage</h2>
        <div>
          <span>Uncached Input</span>
          <b>{nf.format(sessionFacts.uncachedInputTokens)}</b>
          <small>${sessionFacts.pricing.input}/1M</small>
        </div>
        <div>
          <span>Cached Input</span>
          <b>{nf.format(sessionFacts.cachedInputTokens)}</b>
          <small>${sessionFacts.pricing.cachedInput}/1M</small>
        </div>
        <div>
          <span>Output inkl. Reasoning</span>
          <b>{nf.format(sessionFacts.outputTokens)}</b>
          <small>${sessionFacts.pricing.output}/1M</small>
        </div>
        <p>
          Reasoning-Tokens ({nf.format(sessionFacts.reasoningTokens)}) sind im
          Output enthalten und werden nicht doppelt berechnet.{" "}
          <a
            href={sessionFacts.pricing.source}
            target="_blank"
            rel="noreferrer"
          >
            Preisquelle
          </a>
        </p>
      </section>
    </>
  );
}
