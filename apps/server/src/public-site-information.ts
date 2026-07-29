import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { appBase } from "./launcher.ts";

const nullableText = z.string().trim().min(1).nullable();

export const publicSiteInformationSchema = z.object({
  operatorName: z.string().trim().min(1),
  serviceAddress: z.tuple([
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
  ]),
  contactEmail: z.email(),
  vatId: nullableText,
  register: nullableText,
  supervisoryAuthority: nullableText,
  dataProtectionAuthority: z.object({
    name: z.string().trim().min(1),
    address: z.tuple([
      z.string().trim().min(1),
      z.string().trim().min(1),
      z.string().trim().min(1),
    ]),
    email: z.email(),
    website: z.url(),
  }),
  dataRetention: z.string().trim().min(1),
  lastUpdated: z.iso.date(),
});

export type PublicSiteInformation = z.infer<typeof publicSiteInformationSchema>;

export function publicSiteInformationPath() {
  return (
    process.env.PUBLIC_SITE_INFORMATION_PATH ??
    join(appBase(), ".local", "public-site-information.json")
  );
}

export async function loadPublicSiteInformation(): Promise<PublicSiteInformation> {
  const path = publicSiteInformationPath();
  if (!existsSync(path))
    throw new Error(
      `Öffentliche Betreiberangaben fehlen: ${path}. Kopieren Sie die Beispielkonfiguration und ergänzen Sie die Pflichtangaben.`,
    );
  const value = await readFile(path, "utf8");
  return publicSiteInformationSchema.parse(JSON.parse(value));
}
