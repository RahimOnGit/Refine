// Background service worker – handles Groq API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refineText') {
    // 1. Retrieve the Groq API key (saved as 'groq_key' by the popup)
    chrome.storage.local.get(['groq_key'], async (result) => {
      const apiKey = result.groq_key;
      if (!apiKey) {
        sendResponse({ error: 'Please set your Groq API key in the extension popup.' });
        return;
      }

      // 2. Determine system prompt based on the requested format
     let systemPrompt = 'You are a writing editor. The user will provide draft text. Your only task is to rewrite it with better grammar, clarity, and style, while keeping the original meaning. You must output ONLY the rewritten text. Do not add any preface, explanation, commentary, or ask questions. Output the refined version directly.';

if (request.format) {
  const fmt = request.format.toLowerCase();
  if (fmt === 'email') {
    systemPrompt = 'You are a professional executive assistant. The user will provide notes for an email. Turn them into a polite, professional, and clear email message. Output ONLY the email. Do not include any salutation like "Sure!" or "Here is your email". Just output the email body.';
  } else if (fmt === 'social') {
    systemPrompt = 'You are a creative social media manager. The user will provide notes for a post. Turn them into an engaging social media post with 1-2 emojis and relevant hashtags. Output ONLY the post text. Do not add commentary like "Here is your post".';
  }
}

      // 3. Call Groq API (OpenAI‑compatible endpoint)
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 1024,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: request.text },
            ],
          }),
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
          sendResponse({ refined: data.choices[0].message.content.trim() });
        } else {
          sendResponse({ error: 'Groq API error: ' + (data.error?.message || 'Unknown error') });
        }
      } catch (err) {
        sendResponse({ error: 'Failed to connect to Groq: ' + err.message });
      }
    });
    // Keep the message channel open for async response
    return true;
  }
});