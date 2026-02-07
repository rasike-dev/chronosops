import { Injectable } from "@nestjs/common";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

@Injectable()
export class VersionService {
  private readonly version: string;
  private readonly buildTime: string;
  private readonly gitSha: string | null;
  private readonly promptVersion: string;

  constructor() {
    // Read package.json for version
    try {
      const pkg = JSON.parse(
        readFileSync(join(__dirname, "../../../package.json"), "utf-8")
      );
      this.version = pkg.version || "0.0.1";
    } catch {
      this.version = "0.0.1";
    }

    // Build time (set at build time via environment variable or use current time)
    this.buildTime = process.env.BUILD_TIME || new Date().toISOString();

    // Git SHA (from .git/HEAD or BUILD_GIT_SHA env var)
    this.gitSha = this.getGitSha();

    // Prompt version (from reasoning module)
    this.promptVersion = process.env.PROMPT_VERSION || "v1";
  }

  private getGitSha(): string | null {
    // Try BUILD_GIT_SHA first (set by CI/CD)
    if (process.env.BUILD_GIT_SHA) {
      return process.env.BUILD_GIT_SHA.substring(0, 7);
    }

    // Try reading from .git/HEAD
    try {
      const gitHeadPath = join(__dirname, "../../../../.git/HEAD");
      if (existsSync(gitHeadPath)) {
        const head = readFileSync(gitHeadPath, "utf-8").trim();
        if (head.startsWith("ref: ")) {
          const refPath = join(__dirname, "../../../../.git", head.substring(5));
          if (existsSync(refPath)) {
            const sha = readFileSync(refPath, "utf-8").trim();
            return sha.substring(0, 7);
          }
        } else {
          // Detached HEAD
          return head.substring(0, 7);
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  getVersion() {
    return {
      service: "chronosops-api",
      version: this.version,
      buildTime: this.buildTime,
      gitSha: this.gitSha,
      promptVersion: this.promptVersion,
      generatorVersion: "v1",
      time: new Date().toISOString(),
    };
  }
}
