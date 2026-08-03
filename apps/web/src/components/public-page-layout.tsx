import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api-client";
import type { PublicSiteInformation } from "../lib/public-site-information";
import { BrandLockup } from "./brand-mark";
import { PublicFooter } from "./public-footer";

export function PublicPageLayout({
  children,
}: {
  children: (information: PublicSiteInformation) => React.ReactNode;
}) {
  const [information, setInformation] = useState<PublicSiteInformation | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .publicSiteInformation()
      .then(setInformation)
      .catch((reason: Error) => setError(reason.message));
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link to="/" className="text-foreground">
            <BrandLockup />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:py-16">
        <Link
          className="mb-8 inline-flex items-center gap-2 text-label text-primary hover:underline"
          to="/"
        >
          <ArrowLeft className="size-4" /> Zur Anmeldung
        </Link>
        {error && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {information
          ? children(information)
          : !error && (
              <p className="text-muted-foreground">
                Informationen werden geladen …
              </p>
            )}
      </main>
      <PublicFooter />
    </div>
  );
}
