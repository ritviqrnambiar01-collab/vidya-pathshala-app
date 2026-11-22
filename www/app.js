let chapters = [];
let allFormulas = [];
let deck = [];
let deckIndex = 0;
let mastered = 0;
let subFilter = "all";

let savedIds = JSON.parse(localStorage.getItem("vp_saved") || "[]");
let revisedIds = JSON.parse(localStorage.getItem("vp_revised") || "[]");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showLoadError(message) {
  const notesEl = document.getElementById("notesContainer");
  if (notesEl) {
    notesEl.innerHTML = `<div class="card"><strong>Could not load study data:</strong> ${escapeHtml(message)}</div>`;
  }
  const cardQ = document.getElementById("cardQ");
  if (cardQ) {
    cardQ.textContent = "Unable to load formulas. Check formulas.json syntax.";
  }
}

async function loadData() {
  try {
    const [chRes, fRes] = await Promise.all([
      fetch("./chapters.json"),
      fetch("./formulas.json")
    ]);

    if (!chRes.ok) {
      throw new Error(`chapters.json failed (${chRes.status})`);
    }
    if (!fRes.ok) {
      throw new Error(`formulas.json failed (${fRes.status})`);
    }

    const chData = await chRes.json();
    const fData = await fRes.json();

    chapters = Array.isArray(chData) ? chData : [];
    allFormulas = Array.isArray(fData) ? fData : [];
  } catch (err) {
    console.error("Failed to load Vidya Pathshala data:", err);
    showLoadError(err.message || "Invalid JSON or missing file.");
  }

  resetDeck();
  updateProgress();
  renderNotes();
}

function updateProgress() {
  document.getElementById("savedCount").textContent = savedIds.length;
  document.getElementById("progressText").textContent = `${revisedIds.length}/${chapters.length} Revised`;
}

function switchMode(mode) {
  document.getElementById("tabNotes").classList.toggle("active", mode === "notes");
  document.getElementById("tabDeck").classList.toggle("active", mode === "deck");
  document.getElementById("notesView").style.display = mode === "notes" ? "block" : "none";
  document.getElementById("deckView").style.display = mode === "deck" ? "flex" : "none";
}

function setSubFilter(filter, btn) {
  document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  subFilter = filter;
  renderNotes();
}

function onFilterChange() {
  renderNotes();
  resetDeck();
}

function toggleSaved(id) {
  savedIds = savedIds.includes(id) ? savedIds.filter(x => x !== id) : [...savedIds, id];
  localStorage.setItem("vp_saved", JSON.stringify(savedIds));
  updateProgress();
  renderNotes();
}

function toggleRevised(id) {
  revisedIds = revisedIds.includes(id) ? revisedIds.filter(x => x !== id) : [...revisedIds, id];
  localStorage.setItem("vp_revised", JSON.stringify(revisedIds));
  updateProgress();
  renderNotes();
}

function renderNotes() {
  const selectedClass = document.getElementById("classSelect").value;
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const container = document.getElementById("notesContainer");

  const filtered = chapters.filter(ch => {
    const cls = String(ch.class ?? ch.classLevel ?? "");
    if (selectedClass !== "all" && cls !== selectedClass) return false;
    if (subFilter === "saved" && !savedIds.includes(ch.id)) return false;
    if (query && !JSON.stringify(ch).toLowerCase().includes(query)) return false;
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="card">No chapters match this filter yet. More Classes 1–10 chapters can be added anytime in <code>chapters.json</code>.</div>`;
    return;
  }

  container.innerHTML = filtered.map(ch => {
    const isSaved = savedIds.includes(ch.id);
    const isRevised = revisedIds.includes(ch.id);
    const clsLabel = ch.class ?? ch.classLevel ?? "";
    const heading = ch.chapter ?? ch.title ?? "Untitled Chapter";
    const notesList = Array.isArray(ch.notes) ? ch.notes : [];
    const termsEntries = ch.key_terms && typeof ch.key_terms === "object"
      ? Object.entries(ch.key_terms)
      : [];

    const summaryHtml = Array.isArray(ch.summary)
      ? `<ul>${ch.summary.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : ch.summary
        ? `<p>${escapeHtml(ch.summary)}</p>`
        : "";

    const notesHtml = notesList.length
      ? `<div class="sec-title">Key Study Notes</div><ul>${notesList.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
      : "";

    const termsHtml = termsEntries.length
      ? `<div class="sec-title">Key Terms &amp; Kannada</div>${termsEntries.map(([en, kn]) => `<div class="item-box"><strong>${escapeHtml(en)}:</strong> ${escapeHtml(kn)}</div>`).join("")}`
      : "";

    return `
      <article class="card">
        <div class="top-meta">
          <span class="class-tag">Class ${escapeHtml(clsLabel)} • ${escapeHtml(ch.subject)}</span>
          <span>${escapeHtml(ch.id)}</span>
        </div>
        <h2>${escapeHtml(heading)}</h2>

        ${summaryHtml ? `<div class="sec-title">Summary</div>${summaryHtml}` : ""}
        ${notesHtml}
        ${termsHtml}

        <div class="card-actions">
          <button class="act-btn ${isSaved ? "saved" : ""}" onclick="toggleSaved('${escapeHtml(ch.id)}')">
            ${isSaved ? "★ Saved" : "☆ Save"}
          </button>
          <button class="act-btn ${isRevised ? "done" : ""}" onclick="toggleRevised('${escapeHtml(ch.id)}')">
            ${isRevised ? "✓ Revised" : "Mark Revised"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function matchesClassFilter(classRangeOrLevel, selectedClass) {
  if (selectedClass === "all") return true;
  const target = Number(selectedClass);
  const raw = String(classRangeOrLevel ?? "").trim();
  if (!raw) return true;
  if (/^\d+$/.test(raw)) return Number(raw) === target;
  const rangeMatch = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return target >= start && target <= end;
  }
  return raw.split(",").map(s => s.trim()).includes(String(target));
}

function resetDeck() {
  const selectedClass = document.getElementById("classSelect").value;
  deck = allFormulas.filter(f =>
    matchesClassFilter(f.class_range ?? f.classLevel, selectedClass)
  );
  deckIndex = 0;
  document.getElementById("flipCard").classList.remove("flipped");
  renderCard();
}

function renderCard() {
  document.getElementById("flipCard").classList.remove("flipped");
  if (!deck.length) {
    document.getElementById("cardMeta").textContent = "Deck Complete";
    document.getElementById("cardQ").textContent = "No cards left in this filter—great job!";
    document.getElementById("cardAns").textContent = "All Done";
    document.getElementById("cardTip").textContent = "Switch class filter or tap Practice Again to review.";
    document.getElementById("deckCounter").textContent = "0 cards";
    return;
  }
  const item = deck[deckIndex];
  const classInfo = item.class_range ? `Classes ${item.class_range}` : `Class ${item.classLevel ?? ""}`;
  const topicInfo = item.topic ? ` • ${item.topic}` : "";
  const questionText = item.title ?? item.q ?? "Formula Card";
  const answerText = item.formula ?? "";
  const tipParts = [item.explanation ?? item.tip, item.example ? `Example: ${item.example}` : ""].filter(Boolean);

  document.getElementById("cardMeta").textContent = `${classInfo} • ${item.subject ?? ""}${topicInfo}`;
  document.getElementById("cardQ").textContent = questionText;
  document.getElementById("cardAns").textContent = answerText;
  document.getElementById("cardTip").textContent = tipParts.join(" — ");
  document.getElementById("deckCounter").textContent = `Card ${deckIndex + 1} of ${deck.length}`;
}

function flipCard() {
  if (deck.length) {
    document.getElementById("flipCard").classList.toggle("flipped");
  }
}

function rateCard(gotIt) {
  if (!deck.length) return;
  if (gotIt) {
    mastered++;
    document.getElementById("masteredCount").textContent = mastered;
    deck.splice(deckIndex, 1);
    if (deckIndex >= deck.length) deckIndex = 0;
  } else {
    const missed = deck.splice(deckIndex, 1)[0];
    deck.push(missed);
    if (deckIndex >= deck.length) deckIndex = 0;
  }
  renderCard();
}

loadData();
