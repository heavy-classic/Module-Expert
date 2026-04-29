const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT_BASE } = require('./generatorPrompt');

const client = new Anthropic();

const CLARIFIER_INSTRUCTIONS = `You are a DevonWay module design expert. Your job is to identify the most important missing or ambiguous information before generating or modifying a module.

Generate 3 to 5 clarifying questions. Only ask about things that:
1. Are genuinely unclear or not specified in what was provided
2. Would meaningfully change the module's structure, fields, rules, or workflow
3. Have a reasonable recommended answer you can suggest

For each question provide:
- question: The specific question (1–2 clear sentences)
- explanation: Why this matters — what aspect of the module it affects and why getting it right is important
- thinking: What the developer should think about — tradeoffs, implications, examples of how different answers lead to different designs
- recommendedAnswer: A specific, actionable suggested answer (not "it depends" — a real, complete answer based on the context)

Output ONLY a valid JSON array. No markdown fences, no preamble, no text outside the JSON.

Example shape:
[
  {
    "question": "Should records remain editable after they enter the Review stage, or should fields be locked once submitted?",
    "explanation": "This determines whether field-level edit rules are needed for the Review stage. Locking fields after submission is a common compliance requirement that protects the integrity of submitted data.",
    "thinking": "If reviewers need to correct minor errors directly, keep fields editable by Coordinators and above. If your process requires a formal change request to modify a submitted record, lock the fields and add a workflow event for amendment requests. Consider your audit trail requirements.",
    "recommendedAnswer": "Lock all fields once the record moves out of Draft. Only Module Coordinators and Admins should be able to edit after initial submission. Add a Request Amendment workflow event if corrections are needed post-submission."
  }
]`;

async function getClarifyingQuestions(mode, params, xmlContent) {
  let userMessage;

  if (mode === 'generate') {
    const roles = (params.subscriberRoles || []).map(r => `- ${r.code}: ${r.name}`).join('\n');

    let customerLine = '';
    if (params.customerContext && params.customerContext.scraped) {
      const c = params.customerContext;
      customerLine = `\nCustomer: ${c.name} — ${c.industry}\nIndustry terminology: ${(c.terminology || []).join(', ')}\nCommon workflow stages in this industry: ${(c.workflowStages || []).join(' → ')}`;
    } else if (params.customerName) {
      customerLine = `\nCustomer: ${params.customerName}`;
    }

    userMessage = `MODE: Generate new DevonWay module

Module Name: ${params.moduleName}
Module Code: ${params.moduleCode}
Category: ${params.category}
Has Workflow: ${params.hasWorkflow ? 'Yes' : 'No'}${customerLine}

Subscriber Roles:
${roles}

Description:
${params.description}

Generate clarifying questions for this module.`;
  } else {
    const xmlSnippet = xmlContent ? xmlContent.substring(0, 4000) : '';
    userMessage = `MODE: Modify existing DevonWay module

Requested change:
${params.changeDescription}

Existing module XML (excerpt):
${xmlSnippet}

Generate clarifying questions about how to implement these changes.`;
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT_BASE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: CLARIFIER_INSTRUCTIONS },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = message.content[0].text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse clarifying questions from model response');
  return JSON.parse(jsonMatch[0]);
}

module.exports = { getClarifyingQuestions };
