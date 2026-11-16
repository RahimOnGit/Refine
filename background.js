// background.js – handles Groq API calls from content script messages

const SYSTEM_PROMPTS = {
  default: 'You are a writing editor. The user will provide draft text. Your only task is to rewrite it with better grammar, clarity, and style, while keeping the original meaning. You must output ONLY the rewritten text. Do not add any preface, explanation, commentary, or ask questions. Output the refined version directly.',
  email:   'You are a professional executive assistant. The user will provide notes for an email. Turn them into a polite, professional, and clear email message. Output ONLY the email. Do not include any salutation like "Sure!" or "Here is your email". Just output the email body.',
  social:  'You are a creative social media manager. The user will provide notes for a post. Turn them into an engaging social media post with 1-2 emojis and relevant hashtags. Output ONLY the post text. Do not add commentary like "Here is your post".',
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'refineText') return;

  chrome.storage.local.get(['groq_key'], async (result) => {
    const apiKey = result.groq_key;
    if (!apiKey) {
      sendResponse({ error: 'Please set your Groq API key in the extension popup.' });
      return;
    }

    const fmt = (request.format || '').toLowerCase();
    const systemPrompt = SYSTEM_PROMPTS[fmt] || SYSTEM_PROMPTS.default;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.7,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: request.text },
          ],
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]) {
        sendResponse({ refined: data.choices[0].message.content.trim() });
      } else {
        sendResponse({ error: 'Groq API error: ' + (data.error?.message || 'Unknown error') });
      }
    } catch (err) {
      sendResponse({ error: 'Failed to connect to Groq: ' + err.message });
    }
  });

  return true; // keep message channel open for async response
});