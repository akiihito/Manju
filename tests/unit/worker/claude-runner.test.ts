import { describe, it, expect } from "vitest";
import { ClaudeRunner } from "../../../src/worker/claude-runner.js";

describe("ClaudeRunner", () => {
  const runner = new ClaudeRunner("test");

  describe("buildArgs", () => {
    it("should build basic args with -p and output format", () => {
      const args = runner.buildArgs({ prompt: "hello" });
      expect(args).toEqual(["-p", "--output-format", "json"]);
    });

    it("should include system prompt", () => {
      const args = runner.buildArgs({
        prompt: "hello",
        systemPrompt: "You are a tester",
      });
      expect(args).toContain("--system-prompt");
      expect(args).toContain("You are a tester");
    });

    it("should include json schema", () => {
      const schema = { type: "object", properties: { output: { type: "string" } } };
      const args = runner.buildArgs({
        prompt: "hello",
        jsonSchema: schema,
      });
      expect(args).toContain("--json-schema");
      expect(args).toContain(JSON.stringify(schema));
    });

    it("should include max turns", () => {
      const args = runner.buildArgs({
        prompt: "hello",
        maxTurns: 5,
      });
      expect(args).toContain("--max-turns");
      expect(args).toContain("5");
    });

    it("should combine all options", () => {
      const args = runner.buildArgs({
        prompt: "hello",
        systemPrompt: "sys",
        jsonSchema: { type: "object" },
        maxTurns: 3,
      });
      expect(args).toContain("-p");
      expect(args).toContain("--output-format");
      expect(args).toContain("--system-prompt");
      expect(args).toContain("--json-schema");
      expect(args).toContain("--max-turns");
    });
  });

  describe("parseJsonOutput", () => {
    it("should parse claude json output with result field", () => {
      const output = JSON.stringify({
        result: '{"output": "hello", "artifacts": []}',
        cost_usd: 0.01,
      });
      const parsed = runner.parseJsonOutput<{ output: string; artifacts: unknown[] }>(output);
      expect(parsed.output).toBe("hello");
      expect(parsed.artifacts).toEqual([]);
    });

    it("should handle non-string result", () => {
      const output = JSON.stringify({
        result: { output: "hello", artifacts: [] },
      });
      const parsed = runner.parseJsonOutput<{ output: string }>(output);
      expect(parsed.output).toBe("hello");
    });

    it("should handle plain JSON output", () => {
      const output = JSON.stringify({ output: "direct" });
      const parsed = runner.parseJsonOutput<{ output: string }>(output);
      expect(parsed.output).toBe("direct");
    });

    it("should throw on invalid JSON", () => {
      expect(() => runner.parseJsonOutput("not json")).toThrow();
    });

    it("should extract JSON from markdown code fences in result", () => {
      const output = JSON.stringify({
        result: '```json\n{"output": "hello", "artifacts": []}\n```',
      });
      const parsed = runner.parseJsonOutput<{ output: string; artifacts: unknown[] }>(output);
      expect(parsed.output).toBe("hello");
      expect(parsed.artifacts).toEqual([]);
    });

    it("should extract JSON from code fences without language tag", () => {
      const output = JSON.stringify({
        result: '```\n{"output": "hello"}\n```',
      });
      const parsed = runner.parseJsonOutput<{ output: string }>(output);
      expect(parsed.output).toBe("hello");
    });

    it("should handle NDJSON output (multiple JSON lines)", () => {
      const lines = [
        JSON.stringify({ type: "assistant", message: { content: "thinking..." } }),
        JSON.stringify({ type: "result", subtype: "success", result: '{"output": "done"}' }),
      ];
      const output = lines.join("\n");
      const parsed = runner.parseJsonOutput<{ output: string }>(output);
      expect(parsed.output).toBe("done");
    });

    it("should throw with descriptive error when result is non-JSON string", () => {
      const output = JSON.stringify({
        result: "plain text response without JSON",
      });
      expect(() => runner.parseJsonOutput(output)).toThrow(/Failed to extract valid JSON/);
    });
  });
});
