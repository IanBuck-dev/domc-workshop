import { existsSync } from "node:fs";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

type PackageMetadata = {
  name: string;
  version: string;
  license?: string;
  homepage?: string;
  repository?: string | { url?: string };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

type ResolvedPackage = {
  directory: string;
  metadata: PackageMetadata;
};

const repositoryRoot = resolve(import.meta.dirname, "..");
const outputPath = join(repositoryRoot, "THIRD_PARTY_NOTICES.txt");
const fallbackLicenseFiles: Record<string, string> = {
  "@ai-sdk/provider-utils": "node_modules/@ai-sdk/provider/LICENSE",
  "react-remove-scroll-bar": "node_modules/react-remove-scroll/LICENSE",
};
const fallbackLicenseContents: Record<string, string> = {
  standardwebhooks: `MIT License

Copyright Standard Webhooks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
};
const additionalLicenseContents: Record<string, string> = {
  "@anthropic-ai/claude-agent-sdk": `Platform binary notice

© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance.`,
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function normalizeLegalText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function packageDirectory(name: string, fromDirectory: string) {
  let current = fromDirectory;
  while (current.startsWith(repositoryRoot)) {
    const candidate = join(current, "node_modules", ...name.split("/"));
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function productionPackages() {
  const root = await readJson<PackageMetadata>(
    join(repositoryRoot, "package.json"),
  );
  const packages = new Map<string, ResolvedPackage>();

  async function visit(name: string, fromDirectory: string): Promise<void> {
    const unresolved = packageDirectory(name, fromDirectory);
    if (!unresolved) throw new Error(`Produktionsabhängigkeit fehlt: ${name}`);
    // Keep the logical installation path. Resolving a node_modules symlink can move
    // the path outside repositoryRoot and prevent dependency lookup in staged builds.
    const directory = unresolved;
    const metadata = await readJson<PackageMetadata>(
      join(directory, "package.json"),
    );
    const key = `${metadata.name}@${metadata.version}`;
    if (packages.has(key)) return;
    packages.set(key, { directory, metadata });

    for (const dependency of Object.keys(metadata.dependencies ?? {}))
      await visit(dependency, directory);
    // Native optional packages vary by operating system. Their parent packages carry
    // the governing license, so excluding those package wrappers keeps this committed
    // notice identical on macOS, Linux, and Windows.
    for (const dependency of Object.keys(metadata.peerDependencies ?? {})) {
      if (metadata.peerDependenciesMeta?.[dependency]?.optional) continue;
      await visit(dependency, directory);
    }
  }

  for (const dependency of Object.keys(root.dependencies ?? {}))
    await visit(dependency, repositoryRoot);
  return [...packages.values()].sort((left, right) =>
    `${left.metadata.name}@${left.metadata.version}`.localeCompare(
      `${right.metadata.name}@${right.metadata.version}`,
      "en",
    ),
  );
}

function sourceUrl(metadata: PackageMetadata) {
  if (metadata.homepage) return metadata.homepage;
  const repository =
    typeof metadata.repository === "string"
      ? metadata.repository
      : metadata.repository?.url;
  return repository?.replace(/^git\+/, "") ?? "Not supplied by package";
}

async function legalFiles(pkg: ResolvedPackage) {
  const declaredFile = pkg.metadata.license?.match(
    /^SEE LICENSE IN (.+)$/i,
  )?.[1];
  const entries = await readdir(pkg.directory, { withFileTypes: true });
  const candidates = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^(licen[cs]e|copying|notice)(\.|$)/i.test(entry.name),
    )
    .map((entry) => join(pkg.directory, entry.name));
  if (declaredFile && existsSync(join(pkg.directory, declaredFile)))
    candidates.unshift(join(pkg.directory, declaredFile));
  if (candidates.length === 0) {
    const fallback = fallbackLicenseFiles[pkg.metadata.name];
    if (fallback && existsSync(join(repositoryRoot, fallback)))
      candidates.push(join(repositoryRoot, fallback));
  }
  const fallbackContent = fallbackLicenseContents[pkg.metadata.name];
  const unique = [...new Set(candidates)];
  if (unique.length === 0 && !fallbackContent)
    throw new Error(
      `Keine Lizenzdatei für ${pkg.metadata.name}@${pkg.metadata.version} gefunden.`,
    );
  const files = await Promise.all(
    unique.map(async (path) => ({
      name: relative(repositoryRoot, path),
      content: normalizeLegalText(await readFile(path, "utf8")),
    })),
  );
  if (fallbackContent)
    files.push({
      name: "license text reconstructed from package metadata (MIT)",
      content: normalizeLegalText(fallbackContent),
    });
  const additionalContent = additionalLicenseContents[pkg.metadata.name];
  if (additionalContent)
    files.push({
      name: "cross-platform optional binary notice",
      content: normalizeLegalText(additionalContent),
    });
  return files;
}

export async function generateThirdPartyNotices() {
  const sections: string[] = [];
  for (const pkg of await productionPackages()) {
    const files = await legalFiles(pkg);
    sections.push(
      [
        "================================================================================",
        `${pkg.metadata.name}@${pkg.metadata.version}`,
        `Declared license: ${pkg.metadata.license ?? "Not supplied by package"}`,
        `Source: ${sourceUrl(pkg.metadata)}`,
        ...files.flatMap((file) => [
          "",
          `--- ${file.name} ---`,
          "",
          file.content,
        ]),
      ].join("\n"),
    );
  }
  return `${[
    "THIRD-PARTY SOFTWARE NOTICES",
    "",
    "This file contains the license and attribution notices supplied with the",
    "platform-independent production dependency closure of Zukunftswerkstatt.",
    "Optional native package wrappers are covered by their parent package notice.",
    "",
    "Generated by: bun run licenses",
    "Do not edit this file manually. Update dependencies, install from bun.lock, and",
    "run the generator again.",
    "",
    ...sections,
  ].join("\n")}\n`;
}

async function main() {
  const generated = await generateThirdPartyNotices();
  if (process.argv.includes("--check")) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== generated) {
      console.error(
        "THIRD_PARTY_NOTICES.txt ist veraltet. Bitte `bun run licenses` ausführen.",
      );
      process.exit(1);
    }
    console.log("THIRD_PARTY_NOTICES.txt ist aktuell.");
    return;
  }
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, generated, "utf8");
  await rename(temporary, outputPath);
  console.log(
    `THIRD_PARTY_NOTICES.txt mit ${generated.length} Zeichen erzeugt.`,
  );
}

if (import.meta.main) await main();
