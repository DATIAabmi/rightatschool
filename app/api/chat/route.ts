import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const MB_API_KEY   = process.env.METABASE_ADMIN_API_KEY!;
const MCP_URL      = `${METABASE_URL}/api/metabase-mcp`;

interface ChatMessage { role: "user" | "assistant"; content: string }

async function mcpInit(): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": MB_API_KEY },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "dashboard-chat", version: "1.0" } },
    }),
  });
  return res.headers.get("mcp-session-id") ?? "";
}

async function mcpTools(sid: string) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": MB_API_KEY, "Mcp-Session-Id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  const d = await res.json();
  return (d.result?.tools ?? []) as { name: string; description: string; inputSchema: object }[];
}

async function mcpCall(sid: string, name: string, args: object): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": MB_API_KEY, "Mcp-Session-Id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  const d = await res.json();
  const content = d.result?.content;
  if (Array.isArray(content)) return content.map((c: { text?: string }) => c.text ?? "").join("\n");
  return JSON.stringify(d.result ?? d.error ?? "no result");
}

const SYSTEM = `You are Metabot, an AI assistant embedded in the DATIA K12 / Right at School ABMi Intelligence Dashboard.
You help users explore campaign performance data using Metabase tools.

## Database
- Database ID: 34 (BigQuery)

## Tables

### Scoring table (main engagement/lead data)
Table: \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring\`
Columns:
- topic_district       — school district name
- email_domain         — district email domain
- state                — US state abbreviation
- job_title            — contact job title
- Abmi_Campaign        — campaign identifier, e.g. "C7: July 2026 - June 2027"
- engagements          — engagement count (STRING — use SAFE_CAST(engagements AS INT64))
- engaged_user         — unique engaged user identifier
- leads                — lead identifier
- engagement           — REPEATED RECORD (array) containing school board minutes sub-records

### Ad performance table
Table: \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_ad_performance\`
Columns: ad_name, impressions, clicks, spend, campaign

## School Board Minutes
School board minutes (SBM) are stored inside the \`engagement\` repeated field on the scoring table.
To query SBM data, UNNEST the array:

\`\`\`sql
SELECT
  topic_district,
  abmi_campaign,
  email_domain,
  state,
  e.SBM_Date,
  e.curate_topic   AS keyword,
  e.SBM_Context,
  e.SBM_Link
FROM \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring\`,
UNNEST(engagement) AS e
WHERE e.SBM_Date IS NOT NULL
  AND e.SBM_Link IS NOT NULL
\`\`\`

SBM sub-record fields (after UNNEST):
- e.SBM_Date       — date the board meeting occurred
- e.curate_topic   — keyword topic (values: "after school", "child care", "head start", "enrichment")
- e.SBM_Context    — excerpt from the board meeting minutes mentioning the keyword
- e.SBM_Link       — URL link to the full board meeting minutes document

To filter SBM by campaign: add \`AND abmi_campaign = 'C7: July 2026 - June 2027'\`
To filter by keyword topic: add \`AND e.curate_topic = 'after school'\`
To count SBM records by district: \`SELECT topic_district, COUNT(*) AS sbm_count FROM ... GROUP BY 1 ORDER BY 2 DESC\`

## Campaigns
C1: April–May 2025
C2: June–July 2025
C3: August–September 2025
C4: October–November 2025
C5: December 2025–January 2026
C6: February–June 2026
C7: July 2026–June 2027 (current)

## Rules
- Use execute_sql for all data questions, targeting database ID 34.
- SAFE_CAST(engagements AS INT64) is required — the engagements column is a STRING.
- Be concise and format numbers with commas.
- Summarize query results clearly — don't dump raw JSON.
- When asked about school board minutes, use UNNEST(engagement) AS e and query the SBM sub-fields.
- If unsure which column to use, prefer execute_sql over guessing.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const anthropic = new Anthropic({ apiKey });
  const sid = await mcpInit();
  const rawTools = await mcpTools(sid);

  const tools: Anthropic.Tool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: (t.inputSchema ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
  }));

  let claudeMsgs: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM,
    tools,
    messages: claudeMsgs,
  });

  while (resp.stop_reason === "tool_use") {
    claudeMsgs = [...claudeMsgs, { role: "assistant", content: resp.content }];
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type === "tool_use") {
        const out = await mcpCall(sid, block.name, block.input as object);
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    claudeMsgs = [...claudeMsgs, { role: "user", content: results }];
    resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      tools,
      messages: claudeMsgs,
    });
  }

  const reply = resp.content.find((b) => b.type === "text")?.text ?? "";
  return NextResponse.json({ reply });
}
