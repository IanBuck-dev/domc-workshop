import { rm, mkdir, cp, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
const mode = process.argv[2] ?? "web";
const notices = Bun.spawn(
  ["bun", "run", "scripts/generate-third-party-notices.ts", "--check"],
  { stdout: "inherit", stderr: "inherit" },
);
if (await notices.exited) process.exit(1);
await rm("dist", { recursive: true, force: true });
const vite = Bun.spawn(
  [
    "bun",
    "x",
    "vite",
    "build",
    "--config",
    "apps/web/vite.config.ts",
    "--configLoader",
    "native",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await vite.exited) process.exit(1);
if (mode === "release") {
  const publicInformation = Bun.spawn(
    ["bun", "run", "scripts/check-public-site-information.ts"],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (await publicInformation.exited) process.exit(1);
  await mkdir("dist/defaults", { recursive: true });
  await cp("defaults", "dist/defaults", { recursive: true });
  await cp("THIRD_PARTY_NOTICES.txt", "dist/THIRD_PARTY_NOTICES.txt");
  for (const [target, out] of [
    ["bun-darwin-arm64", "dist/Zukunftswerkstatt-macos-arm64"],
    ["bun-windows-x64", "dist/Zukunftswerkstatt-windows-x64.exe"],
    ["bun-linux-arm64", "dist/Zukunftswerkstatt-linux-arm64"],
  ] as const) {
    const p = Bun.spawn(
      [
        "bun",
        "build",
        "apps/server/src/index.ts",
        "--compile",
        `--target=${target}`,
        `--outfile=${out}`,
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    if (await p.exited) process.exit(1);
  }
  for (const [platform, executable] of [
    ["windows-x64", "Zukunftswerkstatt-windows-x64.exe"],
    ["macos-arm64", "Zukunftswerkstatt-macos-arm64"],
    ["linux-arm64", "Zukunftswerkstatt-linux-arm64"],
  ] as const) {
    const staging = join("dist", `.package-${platform}`);
    await mkdir(staging, { recursive: true });
    await cp(join("dist", executable), join(staging, executable));
    await cp("dist/web", join(staging, "web"), { recursive: true });
    await cp("dist/defaults", join(staging, "defaults"), { recursive: true });
    await cp(
      "THIRD_PARTY_NOTICES.txt",
      join(staging, "THIRD_PARTY_NOTICES.txt"),
    );
    if (platform !== "windows-x64")
      await chmod(join(staging, executable), 0o755);
    const zipPath = resolve(`dist/Zukunftswerkstatt-${platform}.zip`);
    const zip = Bun.spawn(["zip", "-q", "-r", zipPath, "."], {
      cwd: staging,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (await zip.exited) process.exit(1);
    await rm(staging, { recursive: true, force: true });
  }
}
