// Save Groq API key to chrome.storage.local
document.getElementById('saveBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  if (!key) {
    showStatus('❗ Please enter a key.', true);
    return;
  }
  chrome.storage.local.set({ groq_key: key }, () => {
    showStatus('✅ Groq API key saved.');
    document.getElementById('apiKey').value = '';
  });
});

function showStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = isError ? 'red' : 'green';
}

// Indicate if a Groq key already exists (do not display it for security)
chrome.storage.local.get(['groq_key'], (result) => {
  if (result.groq_key) {
    document.getElementById('status').textContent = '🔑 Groq key already stored.';
  }
});