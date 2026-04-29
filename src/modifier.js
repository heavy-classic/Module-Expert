const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const STEPS_INSTRUCTIONS = `You are given a DevonWay module change description and the original XML.
Write numbered manual steps explaining how a developer would make these changes in DevonWay Module Builder.
- Group steps by tab (Fields tab, Regions tab, Rules tab, Workflow tab, etc.)
- Be specific: name the exact field, rule, or element being changed
- Describe exactly what to click, what value to enter, what checkbox to check
- If adding a field: specify field type, prompt label, region assignment, order number, any picklist values
- If adding a rule: specify rule type (MB/FR), condition (DXL), targets and their types
- If modifying workflow: specify segment/event names, step orders, flag changes
Output only the numbered steps, no preamble.`;

async function modifyModule(xmlContent, changeDescription, answers) {
  const answersSection = Array.isArray(answers) && answers.length > 0
    ? `\nDeveloper clarifications:\n${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
    : '';

  // Step 1: generate the modified XML — minimal system prompt to avoid reasoning preamble
  const xmlStream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    system: 'You are an XML editor. Output ONLY the raw modified XML document. No explanations, no reasoning, no markdown. Begin your response directly with the XML.',
    messages: [
      {
        role: 'user',
        content: `Apply the following changes to this DevonWay module XML. Output the complete modified XML and absolutely nothing else — no commentary before or after.\n\nChanges to apply:\n${changeDescription}${answersSection}\n\nOriginal XML:\n${xmlContent}`,
      },
    ],
  });

  const xmlMessage = await xmlStream.finalMessage();
  console.log('[modifier] stop_reason:', xmlMessage.stop_reason, '| output_tokens:', xmlMessage.usage?.output_tokens);

  const rawXml = xmlMessage.content[0].text.trim();
  const xmlStart = rawXml.indexOf('<?xml') !== -1 ? rawXml.indexOf('<?xml') : rawXml.indexOf('<SubscriberModule>');
  const xmlEnd = rawXml.lastIndexOf('</SubscriberModule>');

  if (xmlEnd === -1) {
    throw new Error(
      `stop_reason=${xmlMessage.stop_reason} | output_tokens=${xmlMessage.usage?.output_tokens} | ` +
      `head: ${rawXml.slice(0, 400)} ...tail: ${rawXml.slice(-200)}`
    );
  }

  const xml = rawXml.substring(xmlStart, xmlEnd + '</SubscriberModule>'.length).trim();

  // Step 2: generate manual steps (small output, non-fatal)
  let explanation = 'No manual steps provided.';
  try {
    const stepsMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: STEPS_INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: `Change description: ${changeDescription}${answersSection}\n\nOriginal XML (first 8000 chars):\n${xmlContent.slice(0, 8000)}\n\nWrite the manual steps.`,
        },
      ],
    });
    explanation = stepsMessage.content[0].text.trim();
  } catch (err) {
    console.error('[modifier] steps generation failed:', err.message);
  }

  return { xml, explanation };
}

module.exports = { modifyModule };
