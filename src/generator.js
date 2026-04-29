const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT_BASE } = require('./generatorPrompt');

const client = new Anthropic();

const SYSTEM_PROMPT = SYSTEM_PROMPT_BASE;

async function generateModule(params) {
  const {
    description,
    moduleName,
    moduleCode,
    identifierPrefix,
    category,
    hasWorkflow,
    sourceArea,
    reportingAuthorityCode,
    subscriberRoles,
    customerContext,
  } = params;

  const now = new Date();
  const exportDate = now.toUTCString().replace('GMT', '').trim();

  const rolesFormatted = subscriberRoles
    .map(r => `- ${r.code}: ${r.name}`)
    .join('\n');

  let customerSection = '';
  if (customerContext && customerContext.scraped) {
    const c = customerContext;
    customerSection = `
Customer Context (use this to choose realistic, industry-appropriate field names, picklist values, and workflow stages):
- Customer: ${c.name}
- Industry: ${c.industry}
- Description: ${c.description}
- Relevant Regulations/Standards: ${(c.regulations || []).join(', ')}
- Industry Terminology (use for picklist values and field labels): ${(c.terminology || []).join(', ')}
- Suggested Fields for this Industry/Module:
${(c.commonFields || []).map(f => `  * ${f.name} (${f.type}): ${f.description}`).join('\n')}
- Suggested Workflow Stages: ${(c.workflowStages || []).join(' → ')}

Incorporate this customer context to make field labels, picklist options, workflow stage names, and business rules feel native to this customer's industry rather than generic.`;
  } else if (customerContext && customerContext.name) {
    customerSection = `\nCustomer: ${customerContext.name} (no additional industry data available — use your knowledge of this company to inform field design)`;
  }

  let answersSection = '';
  if (Array.isArray(params.answers) && params.answers.length > 0) {
    answersSection = `\n\nDeveloper clarifications (incorporate these into the design):\n${params.answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`;
  }

  const userMessage = `Generate a complete DevonWay module XML definition with these parameters:

Module Name: ${moduleName}
Module Code: ${moduleCode}
Identifier Prefix: ${identifierPrefix}
Category: ${category}
Has Workflow: ${hasWorkflow ? 'Y' : 'N'}
Source Area: ${sourceArea}
Reporting Authority Code: ${reportingAuthorityCode}
Export Date: ${exportDate}

Subscriber Roles:
${rolesFormatted}
${customerSection}
Functional Description:
${description}
${answersSection}

Generate the complete, valid, importable DevonWay module XML. Include all fields, regions, layouts, rules, and workflow elements appropriate for this module based on the description, customer context, and developer clarifications above.`;

  const stream = client.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 32000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const message = await stream.finalMessage();
  const raw = message.content[0].text.trim();

  // Extract XML from the response (Claude should output only XML, but just in case)
  const xmlStart = raw.indexOf('<?xml');
  const xmlEnd = raw.lastIndexOf('</SubscriberModule>');

  if (xmlEnd === -1) {
    throw new Error('Generated output does not contain a valid SubscriberModule XML structure');
  }

  const start = xmlStart === -1 ? raw.indexOf('<SubscriberModule>') : xmlStart;
  return raw.substring(start, xmlEnd + '</SubscriberModule>'.length);
}

module.exports = { generateModule };
