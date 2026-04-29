const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT_BASE } = require('./generatorPrompt');

const client = new Anthropic();

async function modifyModule(xmlContent, changeDescription) {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 32000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_BASE,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `You will be given an existing DevonWay module XML and a description of changes to make. You must produce two things:

1. The complete modified XML (the full file, not just the changed parts)
2. A detailed natural language explanation of exactly what was changed and how a developer could make those same changes manually in DevonWay Module Builder

Format your response EXACTLY like this — no other text:
<MODIFIED_XML>
[the complete modified XML here]
</MODIFIED_XML>
<MANUAL_STEPS>
[the natural language explanation here]
</MANUAL_STEPS>

For the MANUAL_STEPS section:
- Write it as numbered steps a developer would follow in DevonWay Module Builder
- Group steps by tab (Fields tab, Regions tab, Rules tab, Workflow tab, etc.)
- Be specific: name the exact field, rule, or element being changed
- Describe exactly what to click, what value to enter, what checkbox to check
- If adding a field: specify field type, prompt label, region assignment, order number, any picklist values
- If adding a rule: specify rule type (MB/FR), condition (DXL), targets and their types
- If modifying workflow: specify segment/event names, step orders, flag changes
- Write in plain English that a DevonWay developer could follow without seeing the XML`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Here is the existing module XML:

${xmlContent}

Requested changes:
${changeDescription}

Apply the changes and return the complete modified XML plus manual steps as instructed.`,
      },
    ],
  });

  const raw = message.content[0].text;

  const xmlMatch = raw.match(/<MODIFIED_XML>([\s\S]*?)<\/MODIFIED_XML>/);
  const stepsMatch = raw.match(/<MANUAL_STEPS>([\s\S]*?)<\/MANUAL_STEPS>/);

  if (!xmlMatch) throw new Error('Model did not return a valid MODIFIED_XML block');

  const xml = xmlMatch[1].trim();
  const explanation = stepsMatch ? stepsMatch[1].trim() : 'No manual steps provided.';

  if (!xml.includes('<SubscriberModule>') || !xml.includes('</SubscriberModule>')) {
    throw new Error('Modified XML is missing SubscriberModule root element');
  }

  return { xml, explanation };
}

module.exports = { modifyModule };
