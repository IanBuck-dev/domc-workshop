export {};
console.log(`Bun ${Bun.version}`);
const p = Bun.spawn(["claude", "--version"], { stdout: "pipe" });
console.log((await new Response(p.stdout).text()).trim());
process.exit(await p.exited);
