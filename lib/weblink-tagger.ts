import Anthropic from "@anthropic-ai/sdk";
import { apiKeyProblem, imageTagModel, redactSecrets } from "@/lib/image-tags";
import { parseTags, type Weblink } from "@/lib/weblinks";

export const smartTagLimit = 60;
const schema = {
  type: "object",
  properties: {
    links: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, tags: { type: "array", items: { type: "string" } } }, required: ["n", "tags"], additionalProperties: false } },
  },
  required: ["links"],
  additionalProperties: false,
} as const;

const system = `You file saved web links for an artist, designer, and university professor whose practice covers installations, architecture, design-build, additive manufacturing, furniture and products, craft, and public art.
For each numbered link, give two to four short Title Case tags that say what it is about, so similar links group together.
Strongly prefer tags from the existing list when they fit; make a new tag only when none fits. Never use a website's name as a tag.`;

// Suggests topic tags for up to sixty links in one request, reusing the tags already in use where they fit.
export async function smartTags(links: Pick<Weblink, "url" | "title" | "description" | "tags">[], existing: string[]): Promise<string[][]> {
  const keyProblem = apiKeyProblem(process.env.ANTHROPIC_API_KEY);
  if (keyProblem) throw new Error(keyProblem.replace("Image tagging", "Smart tagging"));
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 1, timeout: 50000 });
  const list = links.slice(0, smartTagLimit).map((link, n) => `${n + 1}. ${link.title.slice(0, 200)}\n   ${link.url.slice(0, 300)}${link.description ? `\n   ${link.description.slice(0, 300)}` : ""}`).join("\n");
  const prompt = `Existing tags: ${existing.slice(0, 80).join(", ") || "(none yet)"}\n\nLinks:\n${list}`;
  try {
    const response = await client.messages.create({
      model: imageTagModel, max_tokens: 6000, system,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const text = response.content.flatMap(block => (block.type === "text" ? [block.text] : [])).join("");
    const parsed = JSON.parse(text) as { links?: { n?: number; tags?: unknown }[] };
    const out: string[][] = links.slice(0, smartTagLimit).map(() => []);
    for (const item of parsed.links || []) if (typeof item.n === "number" && item.n >= 1 && item.n <= out.length) out[item.n - 1] = parseTags(item.tags).slice(0, 4);
    return out;
  } catch (problem) {
    throw new Error(`Smart tagging didn't finish: ${redactSecrets(problem instanceof Error ? problem.message : "unknown error")}`);
  }
}
