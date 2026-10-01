export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(`[OCC Security Violation]: ${message}`);
    this.name = "SecurityViolationError";
  }
}

export class SecuritySandbox {
  private safeMode = false;

  constructor(safeMode = false) {
    this.safeMode = safeMode;
  }

  public setSafeMode(enabled: boolean): void {
    this.safeMode = enabled;
  }

  public get isSafeMode(): boolean {
    return this.safeMode;
  }

  /**
   * Validates a module request against safe execution policies.
   */
  public validateModuleAccess(moduleName: string): void {
    if (!this.safeMode) return;

    const blocked = ["child_process", "node:child_process", "cluster", "worker_threads"];
    if (blocked.includes(moduleName)) {
      throw new SecurityViolationError(
        `Direct access to module "${moduleName}" is forbidden in Safe Execution Mode`
      );
    }

    if (moduleName === "fs" || moduleName === "node:fs" || moduleName === "fs/promises") {
      throw new SecurityViolationError(
        "Direct access to Node 'fs' is forbidden in Safe Execution Mode. Use 'context.vault' instead."
      );
    }
  }

  /**
   * Wraps a global environment object with a Proxy enforcing safe mode boundaries.
   */
  public createSafeEnvironment(baseEnv: Record<string, any> = {}): Record<string, any> {
    if (!this.safeMode) return baseEnv;

    const safeRequire = (moduleName: string) => {
      this.validateModuleAccess(moduleName);
      if (typeof (baseEnv as any).require === "function") {
        return (baseEnv as any).require(moduleName);
      }
      throw new SecurityViolationError(`Cannot require "${moduleName}"`);
    };

    return new Proxy(baseEnv, {
      get: (target, prop: string) => {
        if (prop === "require") {
          return safeRequire;
        }
        if (prop === "child_process") {
          throw new SecurityViolationError(
            "Direct access to 'child_process' is forbidden in Safe Execution Mode"
          );
        }
        return target[prop];
      },
    });
  }
}
