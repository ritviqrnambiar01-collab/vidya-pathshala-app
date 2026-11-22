let chapters = [];
let allFormulas = [];
let deck = [];
let deckIndex = 0;
let mastered = 0;
let subFilter = "all";

let savedIds = JSON.parse(localStorage.getItem("vp_saved") || "[]");
let revisedIds = JSON.parse(localStorage.getItem("vp_revised") || "[]");

async function loadData() {
  const [chRes, fRes] = await Promise.all([
    fetch("chapters.json"),
    fetch("formulas.json")
  ]);
  chapters = await chRes.json();
  allFormulas = await fRes.json();
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
    if (selectedClass !== "all" && String(ch.classLevel) !== selectedClass) return false;
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
    return `
      <article class="card">
        <div class="top-meta">
          <span class="class-tag">Class ${ch.classLevel} • ${ch.subject} • Ch. ${ch.chapterNumber}</span>
          <span>${ch.reference}</span>
        </div>
        <h2>${ch.title}</h2>
        <div class="kn-title">${ch.kannadaTitle}</div>

        <div class="sec-title">Quick Summary</div>
        <ul>${ch.summary.map(s => `<li>${s}</li>`).join("")}</ul>

        <div class="sec-title">English ↔ Kannada Key Terms</div>
        ${ch.glossary.map(g => `<div class="item-box"><strong>${g.en}:</strong> ${g.kn}</div>`).join("")}

        <div class="sec-title">Key Questions &amp; Checkpoints</div>
        ${ch.examHotspots.map(h => `
          <div class="q-box">
            <span class="mark-pill">${h.marks}</span> <strong>${h.q}</strong><br/>
            <span>Ans: ${h.a}</span>
          </div>
        `).join("")}

        <div class="sec-title">Tap-to-Reveal Quick Check</div>
        ${ch.flashcards.map((fc, i) => `
          <div class="fc-box" onclick="const a=this.querySelector('.fc-ans'); a.style.display = a.style.display==='block' ? 'none' : 'block';">
            <strong>Q${i + 1}:</strong> ${fc.front}
            <div class="fc-ans">→ ${fc.back}</div>
          </div>
        `).join("")}

        <div class="card-actions">
          <button class="act-btn ${isSaved ? "saved" : ""}" onclick="toggleSaved('${ch.id}')">
            ${isSaved ? "★ Saved" : "☆ Save"}
          </button>
          <button class="act-btn ${isRevised ? "done" : ""}" onclick="toggleRevised('${ch.id}')">
            ${isRevised ? "✓ Revised" : "Mark Revised"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function resetDeck() {
  const selectedClass = document.getElementById("classSelect").value;
  deck = selectedClass === "all"
    ? [...allFormulas]
    : allFormulas.filter(f => String(f.classLevel) === selectedClass);
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
  document.getElementById("cardMeta").textContent = `Class ${item.classLevel} • ${item.subject}`;
  document.getElementById("cardQ").textContent = item.q;
  document.getElementById("cardAns").textContent = item.formula;
  document.getElementById("cardTip").textContent = item.tip;
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
