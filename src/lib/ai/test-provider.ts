import "server-only";
import type { AIProvider, AIRequest, AIStreamEvent } from "./provider";

/**
 * AUTOMATED-TEST PROVIDER — enabled only when PLR_AI_TEST_PROVIDER=echo.
 * Returns deterministic, clearly marked placeholder output in the shape each task expects, so the
 * streaming, parsing and "apply" flows can be tested without an API key. Never enable in real use.
 */
const MARK = "[TEST OUTPUT]";

function outputFor(req: AIRequest): string {
  const prompt = req.messages.map((m) => m.content).join("\n");
  const firstLine = prompt.split("\n").find((l) => /^(Topic|Title|Seed|Niche|Original chapter title):/i.test(l)) ?? "";
  const subject = firstLine.split(":").slice(1).join(":").trim() || "the topic";
  switch (req.task) {
    case "outline.create":
      return JSON.stringify({ title: `${MARK} Outline for ${subject}`, subtitle: "Test subtitle", items: [1, 2, 3].map((n) => ({ title: `${MARK} Part ${n}`, summary: `Summary ${n}`, sections: [`Section ${n}.1`, `Section ${n}.2`] })) });
    case "opportunity.scan":
      return JSON.stringify([{ format: "checklist", name: `${MARK} Quick Checklist`, sourceChapters: [], complexity: "low", positioning: "Test positioning", funnelRole: "lead-magnet", priceLow: 0, priceHigh: 0, rationale: "Test rationale" }]);
    case "research.niche":
      return JSON.stringify([{ text: `${MARK} Need one`, why: "Test", severity: "medium", name: `${MARK} Idea`, format: "ebook", angle: "Test angle", summary: "Persona", goals: ["goal"], pains: ["pain"], objections: ["objection"], channels: ["email"], title: `${MARK} Content idea` }]);
    case "research.keywords":
      return JSON.stringify([1, 2, 3].map((n) => ({ keyword: `${subject} test keyword ${n}`, type: "long-tail", intent: "informational", cluster: "Test cluster" })));
    case "marketing.sales":
      return JSON.stringify({ heading: `${MARK} Heading`, subheading: "Test subheading", body: "Test body copy.", bullets: ["Benefit one", "Benefit two"], items: [{ title: "Item", text: "Item text" }] });
    case "marketing.emails":
      return JSON.stringify([0, 2].map((day) => ({ day, subject: `${MARK} Subject day ${day}`, altSubjects: ["Alt A", "Alt B"], preview: "Preview text", body: "Hi there,\n\nThis is test email body.\n\nThanks", ctaText: "Learn more" })));
    case "marketing.social":
      return JSON.stringify([{ platform: "facebook", type: "educational", text: `${MARK} Test post`, hashtags: ["test"] }]);
    case "marketing.names":
      return JSON.stringify([1, 2, 3].map((n) => ({ name: `${MARK} Name ${n}`, note: "Test note" })));
    case "rebrand.rewrite":
      return `# ${MARK} Rebranded chapter\n\nThis is rebranded test content.\n\n- Point one\n- Point two`;
    case "product.build":
      return `# ${MARK} ${subject}\n\n` + [1, 2, 3].map((n) => `## ${MARK} Part ${n}\n\nTest content for part ${n}.\n\n- [ ] Test action ${n}`).join("\n\n");
    case "test.ping":
      return "OK";
    default:
      return `# ${MARK} ${subject}\n\nThis is deterministic test content produced by the automated-test provider.\n\n## Section\n\n- First point\n- Second point`;
  }
}

export class TestEchoProvider implements AIProvider {
  readonly id = "test-echo";
  readonly label = "Automated test provider (not real AI)";
  isConfigured() {
    return true;
  }
  async *stream(req: AIRequest): AsyncIterable<AIStreamEvent> {
    const text = outputFor(req);
    for (let i = 0; i < text.length; i += 40) {
      yield { type: "delta", text: text.slice(i, i + 40) };
      await new Promise((r) => setTimeout(r, 5));
    }
    yield { type: "done", model: "test-echo", stopReason: "end_turn", usage: { inputTokens: Math.ceil(JSON.stringify(req).length / 4), outputTokens: Math.ceil(text.length / 4) } };
  }
}
