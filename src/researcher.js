const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function researchCustomer(customerName, moduleName) {
  const c = getClient();
  if (!c) return { name: customerName, scraped: false };

  console.log(`[researcher] Researching: ${customerName} / module: ${moduleName}`);

  const prompt = `Research the company "${customerName}" using web search. You are helping design a DevonWay module called "${moduleName}" for this customer.

Return a JSON object with exactly these fields:

- "name": official company name (string)
- "industry": primary industry in 1-4 words (string)
- "description": 2-3 sentences on what the company does and its scale (string)
- "regulations": array of 3-6 specific regulations/standards relevant to this customer's industry and this type of module — e.g. "OSHA 29 CFR 1910.147", "ISO 9001:2015", "FDA 21 CFR Part 820", "NERC CIP-007". Be specific, not generic. (array of strings)
- "terminology": array of 8-12 industry-specific terms, field names, record types, or categories this customer would actually use in a module like this — e.g. for a utility: ["Lockout/Tagout", "NERC CIP", "Substation", "Load Dispatch", "Distribution Main"]. These will be used as picklist values and field labels. (array of strings)
- "commonFields": array of 6-10 specific data fields this customer would want to capture in a "${moduleName}" module, based on their industry. Each entry: { "name": "Field Label", "type": "CS|CL|D|N|P|CB|R", "description": "what this captures" }. Use realistic field names from this customer's domain. (array of objects)
- "workflowStages": if the module is workflow-enabled, array of 2-5 stage names appropriate for this customer's process — e.g. ["Initiate", "Investigation", "Review", "Approval", "Close"]. Think about what this customer's actual business process looks like. (array of strings)
- "scraped": true

Return ONLY valid JSON. No markdown, no explanation.`;

  try {
    const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
    const messages = [{ role: 'user', content: prompt }];

    let response = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools,
      messages,
    });

    while (response.stop_reason === 'tool_use') {
      console.log('[researcher] Tool use, continuing...');
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: b.content || '' }));
      messages.push({ role: 'user', content: toolResults });
      response = await c.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2000, tools, messages });
    }

    const textBlock = response.content.filter(b => b.type === 'text').pop();
    if (!textBlock) return { name: customerName, scraped: false };

    const jsonStr = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    console.log(`[researcher] Done — industry: ${parsed.industry}, fields: ${parsed.commonFields?.length}`);
    return { ...parsed, name: customerName, scraped: true };
  } catch (err) {
    console.error('[researcher] Failed:', err.message);
    return { name: customerName, scraped: false };
  }
}

module.exports = { researchCustomer };
