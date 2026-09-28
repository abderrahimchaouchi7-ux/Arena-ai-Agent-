(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const elements = {
    input: $("#sentenceInput"),
    charCount: $("#charCount"),
    clearInput: $("#clearInput"),
    textareaWrap: $(".textarea-wrap"),
    analyze: $("#analyzeButton"),
    results: $("#resultsSection"),
    sentenceType: $("#sentenceType"),
    modelName: $("#modelName"),
    confidence: $("#confidenceValue"),
    confidenceBar: $("#confidenceBar"),
    elapsed: $("#elapsedValue"),
    summary: $("#summaryText"),
    notes: $("#notesBox"),
    tokenCount: $("#tokenCount"),
    tokensBody: $("#tokensBody"),
    resultSubline: $("#resultSubline"),
    toast: $("#toast"),
    history: $("#historyList"),
    sidebar: $("#sidebar"),
    overlay: $("#mobileOverlay"),
    guide: $("#guideDialog"),
  };

  let lastResult = null;
  let toastTimer = null;
  const HISTORY_KEY = "mi3rab-history-v1";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[char]);
  }

  function updateInputState() {
    const length = elements.input.value.length;
    elements.charCount.textContent = String(length);
    elements.textareaWrap.classList.toggle("has-text", length > 0);
  }

  function selectedLevel() {
    return $("input[name='level']:checked")?.value || "auto";
  }

  function selectLevel(level) {
    const radio = $(`input[name='level'][value='${level}']`);
    if (radio) radio.checked = true;
  }

  function showToast(message, type = "success") {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", type === "error");
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2800);
  }

  function setLoading(loading) {
    elements.analyze.disabled = loading;
    elements.analyze.classList.toggle("loading", loading);
  }

  async function analyze() {
    const text = elements.input.value.trim();
    if (!text) {
      showToast("اكتب جملة عربية أولًا", "error");
      elements.input.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, level: selectedLevel() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحليل الجملة");
      lastResult = data;
      renderResult(data);
      addHistory(text, selectedLevel());
      window.setTimeout(() => elements.results.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (error) {
      showToast(error.message || "تعذر الاتصال بالمحرّك المحلي", "error");
    } finally {
      setLoading(false);
    }
  }

  function kindClass(kind) {
    if (kind.includes("فعل")) return "verb";
    if (kind.includes("حرف") || kind.includes("أداة")) return "particle";
    return "noun";
  }

  function renderResult(data) {
    const percentage = Math.round(data.confidence * 100);
    const wordTokens = data.tokens.filter((token) => token.kind !== "علامة ترقيم");
    elements.sentenceType.textContent = data.sentenceType;
    elements.modelName.textContent = data.model;
    elements.confidence.textContent = `${percentage}٪`;
    elements.confidenceBar.style.width = `${percentage}%`;
    elements.elapsed.textContent = `${Number(data.elapsedMs).toFixed(2)} مللي ثانية`;
    elements.summary.textContent = data.summary;
    elements.resultSubline.textContent = `اختير المستوى ${levelName(data.detectedLevel)} · ${wordTokens.length} ${wordLabel(wordTokens.length)}`;
    elements.tokenCount.textContent = `${wordTokens.length} ${wordLabel(wordTokens.length)}`;
    $("#appVersion").textContent = data.version;

    if (data.notes?.length) {
      elements.notes.innerHTML = data.notes.map((note) => `<p>• ${escapeHTML(note)}</p>`).join("");
      elements.notes.hidden = false;
    } else {
      elements.notes.hidden = true;
      elements.notes.replaceChildren();
    }

    elements.tokensBody.innerHTML = data.tokens.map((token) => {
      const tokenPercent = Math.round(token.confidence * 100);
      const featureHTML = token.features?.length
        ? `<div class="features">${token.features.map((feature) => `<i>${escapeHTML(feature)}</i>`).join("")}</div>`
        : "";
      const state = token.state || "مبني / لا محل";
      const details = token.explanation || token.sign || "—";
      return `
        <tr>
          <td class="word-cell"><strong>${escapeHTML(token.word)}</strong></td>
          <td><span class="kind-badge ${kindClass(token.kind)}">${escapeHTML(token.kind)}</span>${featureHTML}</td>
          <td>${escapeHTML(token.role)}</td>
          <td><span class="state-badge">${escapeHTML(state)}</span></td>
          <td class="explanation-cell">${escapeHTML(details)}</td>
          <td><span class="token-confidence"><b>${tokenPercent}%</b><i style="--score:${tokenPercent}%"></i></span></td>
        </tr>`;
    }).join("");

    elements.results.hidden = false;
  }

  function levelName(level) {
    return ({ easy: "السهل", medium: "المتوسط", hard: "المتقدم", auto: "التلقائي" })[level] || level;
  }

  function wordLabel(count) {
    if (count === 1) return "كلمة";
    if (count >= 3 && count <= 10) return "كلمات";
    return "كلمة";
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value.slice(0, 8) : [];
    } catch (_) {
      return [];
    }
  }

  function addHistory(text, level) {
    const entries = readHistory().filter((entry) => entry.text !== text);
    entries.unshift({ text, level, at: Date.now() });
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 8)));
    } catch (_) { /* التخزين اختياري */ }
    renderHistory();
  }

  function renderHistory() {
    const entries = readHistory();
    if (!entries.length) {
      elements.history.innerHTML = '<p class="empty-history">ستظهر تحليلاتك هنا</p>';
      return;
    }
    elements.history.innerHTML = entries.map((entry, index) =>
      `<button type="button" class="history-item" data-history="${index}" title="${escapeHTML(entry.text)}">${escapeHTML(entry.text)}</button>`
    ).join("");
  }

  function resultAsText() {
    if (!lastResult) return "";
    const lines = [
      `الجملة: ${lastResult.text}`,
      `النوع: ${lastResult.sentenceType}`,
      `النموذج: ${lastResult.model}`,
      `الخلاصة: ${lastResult.summary}`,
      "",
      "إعراب الكلمات:",
    ];
    lastResult.tokens.forEach((token) => {
      lines.push(`- ${token.word}: ${token.role}${token.state ? `، ${token.state}` : ""}. ${token.explanation}`);
    });
    if (lastResult.notes?.length) lines.push("", "ملاحظات:", ...lastResult.notes.map((note) => `- ${note}`));
    return lines.join("\n");
  }

  async function copyResult() {
    if (!lastResult) return;
    const text = resultAsText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    showToast("نُسخت النتيجة إلى الحافظة");
  }

  function exportResult() {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `إعراب-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("تم تصدير ملف النتيجة");
  }

  function closeMobileMenu() {
    elements.sidebar.classList.remove("open");
    elements.overlay.classList.remove("visible");
  }

  elements.input.addEventListener("input", updateInputState);
  elements.input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      analyze();
    }
  });
  elements.clearInput.addEventListener("click", () => {
    elements.input.value = "";
    updateInputState();
    elements.input.focus();
  });
  elements.analyze.addEventListener("click", analyze);
  $("#examplesList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-example]");
    if (!button) return;
    elements.input.value = button.dataset.example;
    updateInputState();
    elements.input.focus();
  });
  elements.history.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history]");
    if (!button) return;
    const entry = readHistory()[Number(button.dataset.history)];
    if (!entry) return;
    elements.input.value = entry.text;
    selectLevel(entry.level);
    updateInputState();
    closeMobileMenu();
    elements.input.focus();
  });
  $("#clearHistory").addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast("مُسح السجل المحلي");
  });
  $("#copyResult").addEventListener("click", copyResult);
  $("#exportResult").addEventListener("click", exportResult);
  $("#menuButton").addEventListener("click", () => {
    elements.sidebar.classList.add("open");
    elements.overlay.classList.add("visible");
  });
  elements.overlay.addEventListener("click", closeMobileMenu);
  $("#showGuide").addEventListener("click", () => {
    closeMobileMenu();
    elements.guide.showModal();
  });
  $("#closeGuide").addEventListener("click", () => elements.guide.close());
  elements.guide.addEventListener("click", (event) => {
    if (event.target === elements.guide) elements.guide.close();
  });

  async function healthCheck() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const health = await response.json();
      if (health.version) $("#appVersion").textContent = health.version;
    } catch (_) {
      $(".top-status").innerHTML = '<span class="status-dot" style="background:#c85a50"></span> المحرّك غير متاح';
    }
  }

  updateInputState();
  renderHistory();
  healthCheck();
})();
