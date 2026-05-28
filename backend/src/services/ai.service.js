function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fallbackSummary(text) {
  const sentences = splitSentences(text);
  if (!sentences.length) return "No transcript content was provided.";
  return sentences.slice(0, 5).join(" ");
}

function fallbackActionItems(text) {
  const cues = /\b(todo|action|follow up|follow-up|need to|needs to|assign|prepare|send|share|review|fix|create|update)\b/i;
  return splitSentences(text)
    .filter((sentence) => cues.test(sentence))
    .slice(0, 12)
    .map((sentence) => ({ text: sentence, status: "pending" }));
}

async function callGroq({ prompt, maxTokens = 600 }) {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateSummary(transcript) {
  const ai = await callGroq({
    prompt: `Summarize this meeting transcript in concise product-team notes:\n\n${transcript}`,
  });
  return ai || fallbackSummary(transcript);
}

export async function extractActionItems(transcript) {
  const ai = await callGroq({
    prompt:
      "Extract meeting action items as strict JSON array. Each item must have text and status fields. Transcript:\n\n" +
      transcript,
  });
  if (ai) {
    try {
      const parsed = JSON.parse(ai.replace(/^```json|```$/g, "").trim());
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          text: String(item.text || item.title || "").trim(),
          status: item.status || "pending",
          assignee: item.assignee,
        })).filter((item) => item.text);
      }
    } catch {
      // Fall through to local extraction.
    }
  }
  return fallbackActionItems(transcript);
}

export async function transcribeAudioPlaceholder({ text }) {
  return String(text || "").trim();
}
