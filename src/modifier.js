const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT_BASE } = require('./generatorPrompt');

const client = new Anthropic();

const MODIFIER_INSTRUCTIONS = `You will be given an existing DevonWay module XML and a description of changes to make.
Output ONLY the complete modified XML — the full file, not just the changed parts.
Do not include any explanation, commentary, or markdown formatting. Start your response with <?xml or <SubscriberModule>.`;

const STEPS_INSTRUCTIONS = `You are given an original DevonWay module XML, a modified version of it, and the change description.
Write numbered manual steps explaining exactly what was changed and how a developer could make those same changes manually in DevonWay Module Builder.
- Group steps by tab (Fields tab, Regions tab, Rules tab, Workflow tab, etc.)
- Be specific: name the exact field, rule, or element being changed
- Describe exactly what to click, what value to enter, what checkbox to check
- If adding a field: specify field type, prompt label, region assignment, order number, any picklist values
- If adding a rule: specify rule type (MB/FR), condition (DXL), targets and their types
- If modifying workflow: specify segment/event names, step orders, flag changes
- Write in plain English that a DevonWay developer could follow without seeing the XML
Output only the steps, no preamble.`;

async function modifyModule(xmlContent, changeDescription, answers) {
  const answersSection = Array.isArray(answers) && answers.length > 0
    ? `\nDeveloper clarifications:\n${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
    : '';

  // Step 1: generate the modified XML only
  const xmlStream = client.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 32000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT_BASE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: MODIFIER_INSTRUCTIONS },
    ],
    messages: [
      {
        role: 'user',
        content: `Here is the existing module XML:\n\n${xmlContent}\n\nRequested changes:\n${changeDescription}${answersSection}\n\nOutput the complete modified XML now.`,
      },
    ],
  });

  const xmlMessage = await xmlStream.finalMessage();
  console.log('[modifier] xml stop_reason:', xmlMessage.stop_reason, '| output tokens:', xmlMessage.usage?.output_tokens);

  const rawXml = xmlMessage.content[0].text.trim();
  const xmlStart = rawXml.indexOf('<?xml') !== -1 ? rawXml.indexOf('<?xml') : rawXml.indexOf('<SubscriberModule>');
  const xmlEnd = rawXml.lastIndexOf('</SubscriberModule>');

  if (xmlEnd === -1) {
    console.error('[modifier] xml head:', rawXml.slice(0, 500));
    console.error('[modifier] xml tail:', rawXml.slice(-500));
    throw new Error('Model did not return a complete SubscriberModule XML. It may have been truncated.');
  }

  const xml = rawXml.substring(xmlStart, xmlEnd + '</SubscriberModule>'.length).trim();

  // Step 2: generate manual steps separately (much smaller output)
  let explanation = 'No manual steps provided.';
  try {
    const stepsMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: [
        { type: 'text', text: STEPS_INSTRUCTIONS },
      ],
      messages: [
        {
          role: 'user',
          content: `Change description: ${changeDescription}${answersSection}\n\nOriginal XML (first 8000 chars):\n${xmlContent.slice(0, 8000)}\n\nModified XML (first 8000 chars):\n${xml.slice(0, 8000)}\n\nWrite the manual steps.`,
        },
      ],
    });
    explanation = stepsMessage.content[0].text.trim();
  } catch (err) {
    console.error('[modifier] steps generation failed:', err.message);
    // Non-fatal — XML is already good
  }

  return { xml, explanation };
}

module.exports = { modifyModule };
