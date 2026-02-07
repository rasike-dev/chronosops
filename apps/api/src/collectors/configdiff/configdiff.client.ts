import { Injectable } from "@nestjs/common";
import type { ConfigDiffItem } from "@chronosops/contracts";

@Injectable()
export class ConfigDiffClient {
  isRealMode(): boolean {
    const mode = process.env.CHRONOSOPS_CONFIG_DIFF_MODE;
    
    // Explicit mode override
    if (mode === "STUB") return false;
    if (mode === "REAL") {
      // REAL mode would require config tracking system
      // For Day 08, we'll default to STUB unless explicitly configured
      return false; // TODO: Enable when config tracking is implemented
    }
    
    // AUTO mode: default to STUB for Day 08
    return false;
  }

  async fetchConfigDiffs(_args: {
    start: string;
    end: string;
    service?: string | null;
    environment?: string | null;
  }): Promise<{ mode: "REAL" | "STUB"; diffs: ConfigDiffItem[]; notes: string[] }> {
    if (!this.isRealMode()) {
      // STUB mode: generate deterministic diffs based on incident type
      // Use a simple hash of window + service to generate stable stub diffs
      const stubDiffs: ConfigDiffItem[] = [];
      
      // Generate a few deterministic config changes
      const hash = _args.service ? _args.service.length : 0;
      const numDiffs = (hash % 3) + 1; // 1-3 diffs
      
      for (let i = 0; i < numDiffs && i < 20; i++) {
        const changeTypes: Array<"ADDED" | "REMOVED" | "UPDATED"> = ["ADDED", "UPDATED", "UPDATED"];
        const changeType = changeTypes[i % changeTypes.length];
        
        stubDiffs.push({
          key: `CONFIG_${i + 1}`,
          before: changeType === "ADDED" ? null : "old_value",
          after: changeType === "REMOVED" ? null : "new_value",
          changeType,
        });
      }
      
      // Add common config changes
      stubDiffs.push({
        key: "DB_POOL_SIZE",
        before: "10",
        after: "20",
        changeType: "UPDATED",
      });
      
      stubDiffs.push({
        key: "FEATURE_FLAG_X",
        before: null,
        after: "enabled",
        changeType: "ADDED",
      });
      
      return {
        mode: "STUB",
        diffs: stubDiffs.slice(0, 20), // Bound to max 20 in stub
        notes: ["CHRONOSOPS_CONFIG_DIFF_MODE=STUB or config tracking not implemented; returning stub config diffs."],
      };
    }

    // REAL implementation
    // TODO: Implement real config diff tracking
    return {
      mode: "REAL",
      diffs: [],
      notes: ["REAL mode not fully implemented yet (Day 08 - placeholder)"],
    };
  }
}
