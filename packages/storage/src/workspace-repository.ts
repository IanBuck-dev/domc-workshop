import { access, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import {
  processCaptureConfigSchema,
  type ProcessCaptureConfig,
} from "../../domain/src/process-understanding.ts";
import { ProcessCaptureRepository } from "./process-capture-repository.ts";
import { OpportunityDiscoveryRepository } from "./opportunity-discovery-repository.ts";
import { MemoryRepository } from "./memory-repository.ts";

export class WorkspaceRepository {
  readonly processes: ProcessCaptureRepository;
  readonly opportunities: OpportunityDiscoveryRepository;
  readonly memory: MemoryRepository;

  constructor(
    public root: string,
    public defaults = join(process.cwd(), "defaults"),
  ) {
    this.processes = new ProcessCaptureRepository(root);
    this.opportunities = new OpportunityDiscoveryRepository(root);
    this.memory = new MemoryRepository(root);
  }

  async ensure() {
    await Promise.all([
      mkdir(join(this.root, "process-captures"), { recursive: true }),
      mkdir(join(this.root, "trash", "process-captures"), { recursive: true }),
      this.memory.ensure(),
    ]);
  }

  async processDefaults(): Promise<ProcessCaptureConfig> {
    return processCaptureConfigSchema.parse(
      await Bun.file(join(this.defaults, "process-capture-config.json")).json(),
    );
  }

  async reset() {
    await this.ensure();
    const source = join(this.root, "process-captures");
    const destination = join(
      this.root,
      "trash",
      "process-captures",
      `reset-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}`,
    );
    try {
      await access(source);
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(source, { recursive: true });
    return destination;
  }
}
