import { ShieldCheck } from "lucide-react";
export function ReviewFlags({ flags }: { flags: string[] }) {
  return (
    <section className="review-flags">
      <h3>
        <ShieldCheck />
        Fachliche Prüfpunkte
      </h3>
      <p>
        Keine Rechtsprüfung – vor einer Umsetzung durch die zuständigen Stellen
        bewerten.
      </p>
      <ul>
        {flags.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="review-parties">
        Datenschutz · Informationssicherheit · Compliance/Recht · Betriebsrat ·
        Fachbereich · IT
      </div>
    </section>
  );
}
