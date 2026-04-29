const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT_BASE } = require('./generatorPrompt');

const client = new Anthropic();

const STEPS_SYSTEM = `You are a DevonWay Module Builder expert. You will be given an existing module XML and a description of changes to make.
Write numbered manual steps explaining exactly how a developer would make these changes in DevonWay Module Builder.
- Group steps by tab (Fields tab, Regions tab, Rules tab, Workflow tab, etc.)
- Be specific: name the exact field, rule, or element
- Describe exactly what to click, what value to enter, what checkbox to check
- If adding a field: specify field type, prompt label, region assignment, order number, any picklist values
- If adding a rule: specify rule type (MB/FR), condition (DXL), targets and their types
- If modifying workflow: specify segment/event names, step orders, flag changes
Output only the numbered steps, no preamble.`;

const XML_SYSTEM = 'You are an XML editor. Output ONLY the raw modified XML document. No explanations, no reasoning, no markdown. Begin your response directly with the XML.';

function buildAnswersSection(answers) {
  if (!Array.isArray(answers) || answers.length === 0) return '';
  return `\nDeveloper clarifications:\n${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`;
}

async function getModifySteps(xmlContent, changeDescription, answers) {
  const answersSection = buildAnswersSection(answers);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT_BASE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: STEPS_SYSTEM },
    ],
    messages: [
      {
        role: 'user',
        content: `Here is the existing module XML:\n\n${xmlContent}\n\nRequested changes:\n${changeDescription}${answersSection}\n\nWrite the manual steps.`,
      },
    ],
  });

  return message.content[0].text.trim();
}

async function generateModifiedXml(xmlContent, changeDescription, answers) {
  const answersSection = buildAnswersSection(answers);

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    system: XML_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Apply the following changes to this DevonWay module XML. Output the complete modified XML and absolutely nothing else.\n\nChanges:\n${changeDescription}${answersSection}\n\nOriginal XML:\n${xmlContent}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  console.log('[modifier/xml] stop_reason:', message.stop_reason, '| output_tokens:', message.usage?.output_tokens);

  if (message.stop_reason === 'max_tokens') {
    throw new Error('This module XML is too large to generate automatically. Please follow the manual steps above to make the changes in Module Builder.');
  }

  const raw = message.content[0].text.trim();
  const xmlStart = raw.indexOf('<?xml') !== -1 ? raw.indexOf('<?xml') : raw.indexOf('<SubscriberModule>');
  const xmlEnd = raw.lastIndexOf('</SubscriberModule>');

  if (xmlEnd === -1) {
    throw new Error('This module XML is too large to generate automatically. Please follow the manual steps above to make the changes in Module Builder.');
  }

  return raw.substring(xmlStart, xmlEnd + '</SubscriberModule>'.length).trim();
}

module.exports = { getModifySteps, generateModifiedXml };
