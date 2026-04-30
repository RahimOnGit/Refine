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
      let systemPrompt = 'You are a helpful writing assistant. Refine the user\'s text to be clearer and better written.';
      if (request.format) {
        const fmt = request.format.toLowerCase();
        if (fmt === 'email') {
          systemPrompt = 'You are a professional executive assistant. Expand the following notes into a polite, professional, and clear email. Output ONLY the email text.';
        } else if (fmt === 'social') {
          systemPrompt = 'You are a creative social media manager. Turn the following notes into an engaging post with 1-2 emojis and relevant hashtags. Output ONLY the post text.';
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