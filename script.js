// ============================================================
// TRB Document Summarizer frontend logic
// Talks to the FastAPI backend at API_BASE for upload,
// summarize, and chat.
// ============================================================

const API_BASE = "http://localhost:8000";

let currentDocId = null;
let chatHistory = [];

// ---------- Element refs ----------
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const uploadError = document.getElementById("uploadError");

const docMeta = document.getElementById("docMeta");
const metaFilename = document.getElementById("metaFilename");
const metaWords = document.getElementById("metaWords");
const summarizeBtn = document.getElementById("summarizeBtn");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const loadingText = document.getElementById("loadingText");
const summaryState = document.getElementById("summaryState");

const chatWidget = document.getElementById("chatWidget");
const chatToggle = document.getElementById("chatToggle");
const chatClose = document.getElementById("chatClose");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

// ---------- Upload interactions ----------
dropzone.addEventListener("click", () => fileInput.click());

["dragenter", "dragover"].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (file) handleUpload(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleUpload(fileInput.files[0]);
});

function showUploadError(msg) {
  uploadError.textContent = msg;
  uploadError.hidden = false;
}
function clearUploadError() {
  uploadError.hidden = true;
}

async function handleUpload(file) {
  clearUploadError();
  const allowed = [".pdf", ".docx", ".txt", ".md"];
  const ok = allowed.some(ext => file.name.toLowerCase().endsWith(ext));
  if (!ok) {
    showUploadError("Please upload a PDF, DOCX, TXT or MD file.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  dropzone.classList.add("dragover");
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed.");

    currentDocId = data.doc_id;
    metaFilename.textContent = data.filename;
    metaWords.textContent = `${data.word_count.toLocaleString()} words extracted`;
    docMeta.hidden = false;
    summarizeBtn.disabled = false;

    // Reset chat for the new document
    resetChat();
  } catch (err) {
    showUploadError(err.message);
  } finally {
    dropzone.classList.remove("dragover");
  }
}

// ---------- Summarize ----------
summarizeBtn.addEventListener("click", generateSummary);

async function generateSummary() {
  if (!currentDocId) return;

  emptyState.hidden = true;
  summaryState.hidden = true;
  loadingState.hidden = false;
  loadingText.textContent = "Reading your document…";
  summarizeBtn.disabled = true;

  const messages = [
    "Reading your document…",
    "Identifying key topics…",
    "Working out why it matters…",
    "Putting the summary together…",
  ];
  let i = 0;
  const interval = setInterval(() => {
    i = (i + 1) % messages.length;
    loadingText.textContent = messages[i];
  }, 1400);

  try {
    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_id: currentDocId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Summarization failed.");

    renderSummary(data.summary);
    loadingState.hidden = true;
    summaryState.hidden = false;

    enableChat();
  } catch (err) {
    loadingState.hidden = true;
    emptyState.hidden = false;
    showUploadError(err.message);
  } finally {
    clearInterval(interval);
    summarizeBtn.disabled = false;
  }
}

function renderSummary(summary) {
  document.getElementById("docType").textContent = summary.document_type || "Document";
  document.getElementById("docTitle").textContent = summary.title || "Untitled Document";
  document.getElementById("docOverview").textContent = summary.overview || "";
  document.getElementById("importanceText").textContent = summary.importance || "";
  document.getElementById("whyUsedText").textContent = summary.why_used || "";

  fillList("keyTopics", summary.key_topics, "chip");
  fillList("benefitsList", summary.benefits, "plain");
  fillList("useCasesList", summary.use_cases, "plain");
  fillList("takeawaysList", summary.key_takeaways, "plain");
}

function fillList(id, items, type) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  (items || []).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  });
}

// ---------- Chat ----------
chatToggle.addEventListener("click", () => chatWidget.classList.add("expanded"));
chatClose.addEventListener("click", () => chatWidget.classList.remove("expanded"));

function enableChat() {
  chatInput.disabled = false;
  chatSend.disabled = false;
  document.getElementById("chatToggleLabel").textContent = "Ask about this document";
}

function resetChat() {
  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="chat-msg bot">
      <p>Document loaded! Click <strong>Generate Summary</strong>, then ask me anything about it —
      like what it's about, why it matters, or what its benefits are.</p>
    </div>`;
  chatInput.disabled = true;
  chatSend.disabled = true;
  chatInput.value = "";
}

chatForm.addEventListener("submit", async e => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message || !currentDocId) return;

  appendMessage("user", message);
  chatHistory.push({ role: "user", content: message });
  chatInput.value = "";
  chatInput.disabled = true;
  chatSend.disabled = true;

  const thinkingEl = appendThinking();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: currentDocId,
        message,
        history: chatHistory,
      }),
    });
    const data = await res.json();
    thinkingEl.remove();

    if (!res.ok) throw new Error(data.detail || "Something went wrong.");

    appendMessage("bot", data.reply);
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    thinkingEl.remove();
    appendMessage("bot", `⚠️ ${err.message}`);
  } finally {
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.focus();
  }
});

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role === "user" ? "user" : "bot"}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function appendThinking() {
  const div = document.createElement("div");
  div.className = "chat-msg bot thinking";
  div.innerHTML = "<span></span><span></span><span></span>";
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}
