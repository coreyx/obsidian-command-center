import type { OCCCommand, OCCCommandMetadata } from "../types/command";
import type { ExecutionContext } from "../types/context";
import type { MacroDefinition, MacroStepExecutionRecord } from "../types/macro";

export class MacroOrchestrator {
  /**
   * Validates a raw macro object and returns a typed MacroDefinition.
   */
  validateDefinition(raw: any, sourcePath: string): MacroDefinition {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Invalid macro definition in ${sourcePath}: expected an object`);
    }

    if (!raw.id || typeof raw.id !== "string" || raw.id.trim() === "") {
      throw new Error(`Macro in ${sourcePath} has missing or invalid "id"`);
    }

    if (!raw.name || typeof raw.name !== "string" || raw.name.trim() === "") {
      throw new Error(`Macro in ${sourcePath} has missing or invalid "name"`);
    }

    if (!Array.isArray(raw.steps)) {
      throw new Error(`Macro in ${sourcePath} must declare a "steps" array`);
    }

    const steps = raw.steps.map((step: any, index: number) => {
      if (typeof step === "string") {
        return { commandId: step };
      }
      if (!step || typeof step !== "object" || !step.commandId) {
        throw new Error(
          `Macro "${raw.id}" step at index ${index} must have a valid "commandId"`
        );
      }
      return {
        id: step.id,
        commandId: step.commandId,
        params: step.params,
        onError: step.onError ?? "halt",
        fallbackCommandId: step.fallbackCommandId,
      };
    });

    return {
      id: raw.id,
      name: raw.name,
      icon: raw.icon,
      description: raw.description,
      queueName: raw.queueName,
      debounce: raw.debounce,
      throttle: raw.throttle,
      timeout: raw.timeout,
      steps,
    };
  }

  /**
   * Transforms a MacroDefinition into an executable OCCCommand with sequential piping.
   */
  createCommand(definition: MacroDefinition): OCCCommand {
    const metadata: OCCCommandMetadata = {
      id: definition.id,
      name: definition.name,
      icon: definition.icon,
      description: definition.description,
      queueName: definition.queueName,
      debounce: definition.debounce,
      throttle: definition.throttle,
      timeout: definition.timeout,
    };

    return {
      metadata,
      execute: async (context: ExecutionContext): Promise<unknown> => {
        const records: MacroStepExecutionRecord[] = [];
        let currentPayload: unknown = context.input;

        for (let i = 0; i < definition.steps.length; i++) {
          const step = definition.steps[i]!;
          const stepInput = currentPayload;

          const record: MacroStepExecutionRecord = {
            stepIndex: i,
            stepId: step.id,
            commandId: step.commandId,
            input: stepInput,
            status: "success",
          };

          // Update context with step history and latest pipeline payload
          context.input = stepInput;
          context.$prevOutput = stepInput;
          context.steps = records;

          try {
            const stepResult = await context.commands.execute(step.commandId, step.params);
            record.output = stepResult;
            record.status = "success";
            currentPayload = stepResult !== undefined ? stepResult : currentPayload;
          } catch (stepError: any) {
            record.error = stepError;
            record.status = "failed";

            const errorPolicy = step.onError ?? "halt";

            if (errorPolicy === "continue") {
              console.warn(
                `[OCC Macro: ${definition.id}] Step ${i} ("${step.commandId}") failed with "continue" policy:`,
                stepError.message
              );
            } else if (errorPolicy === "fallback") {
              if (step.fallbackCommandId) {
                try {
                  console.info(
                    `[OCC Macro: ${definition.id}] Executing fallback command "${step.fallbackCommandId}" for step ${i}`
                  );
                  const fallbackResult = await context.commands.execute(step.fallbackCommandId);
                  currentPayload = fallbackResult !== undefined ? fallbackResult : currentPayload;
                } catch (fallbackError: any) {
                  throw new Error(
                    `Macro "${definition.name}" step ${i} failed and fallback command "${step.fallbackCommandId}" also failed: ${fallbackError.message}`
                  );
                }
              }
            } else {
              // "halt" (default)
              throw new Error(
                `Macro "${definition.name}" step ${i} ("${step.commandId}") failed: ${stepError.message}`
              );
            }
          }

          records.push(record);
        }

        context.input = currentPayload;
        context.$prevOutput = currentPayload;
        return currentPayload;
      },
    };
  }
}
