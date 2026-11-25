
let chapters = [];
let allFormulas = [];
let deck = [];
let deckIndex = 0;
let mastered = 0;
let subFilter = "all";

let selectedClass = "";
let selectedSubject = "";
let selectedChapterId = "";

const STORAGE_KEYS = {
  lang: "vp_lang_v1",
  bookmarks: "vp_bookmarks_v1",
  completed: "vp_completed_v1",
  quizHistory: "vp_quiz_history_v1"
};

let currentLang = localStorage.getItem(STORAGE_KEYS.lang) === "kn" ? "kn" : "en";
let bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.bookmarks) || "[]");
let completedChapters = JSON.parse(localStorage.getItem(STORAGE_KEYS.completed) || "[]");
let quizHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.quizHistory) || "{}");
let activeQuizSelections = {};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickText(field) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[currentLang] ?? field.en ?? field.kn ?? "";
}

function pickList(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  const arr = field[currentLang] ?? field.en ?? field.kn ?? [];
  return Array.isArray(arr) ? arr : [];
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Keep app working even if WebView storage is constrained
  }
}

function setLanguage(lang) {
  currentLang = lang === "kn" ? "kn" : "en";

  try {
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
  } catch (_) {}

  const enBtn = document.getElementById("langEnBtn");
  const knBtn = document.getElementById("langKnBtn");

  if (enBtn) enBtn.classList.toggle("active", currentLang === "en");
  if (knBtn) knBtn.classList.toggle("active", currentLang === "kn");

  renderNotes();
  renderCard();
}

function hideSplashScreen() {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("splash-hide");

    setTimeout(() => {
      if (splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 250);
  }, 650);
}

function showLoadError(message) {
  const notesEl = document.getElementById("notesContainer");

  if (notesEl) {
    notesEl.innerHTML = `
      <div class="card">
        <strong>Offline Data Notice:</strong>
        ${escapeHtml(message)}
      </div>
    `;
  }

  const cardQ = document.getElementById("cardQ");

  if (cardQ) {
    cardQ.textContent = "Unable to load formulas locally. Verify formulas.json.";
  }
}

async function loadStudyChapters() {
  try {
    const studyRes = await fetch("./study_data.json");

    if (studyRes.ok) {
      const parsed = await studyRes.json();

      if (Array.isArray(parsed.chapters)) return parsed.chapters;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {
    // Fall back to chapters.json if needed
  }

  const chRes = await fetch("./chapters.json");

  if (!chRes.ok) {
    throw new Error(`Study data load failed (${chRes.status})`);
  }

  const chData = await chRes.json();

  return Array.isArray(chData) ? chData : [];
}

async function loadData() {
  const enBtn = document.getElementById("langEnBtn");
  const knBtn = document.getElementById("langKnBtn");

  if (enBtn) enBtn.classList.toggle("active", currentLang === "en");
  if (knBtn) knBtn.classList.toggle("active", currentLang === "kn");

  try {
    const [loadedChapters, fRes] = await Promise.all([
      loadStudyChapters(),
      fetch("./formulas.json").catch(() => null)
    ]);

    chapters = loadedChapters;

    if (fRes && fRes.ok) {
      const fData = await fRes.json();
      allFormulas = Array.isArray(fData) ? fData : [];
    }
  } catch (err) {
    console.error("Vidya Pathshala offline load error:", err);
    showLoadError(err.message || "Could not read local study files.");
  }

  populateSubjects();
  resetDeck();
  updateProgress();
  renderNotes();
  updateDashboard();
  renderMyLearning();
  hideSplashScreen();
}

function updateProgress() {
  const savedEl = document.getElementById("savedCount");
  const progEl = document.getElementById("progressText");

  if (savedEl) savedEl.textContent = bookmarks.length;

  if (progEl) {
    progEl.textContent = `${completedChapters.length}/${chapters.length} Completed`;
  }

  updateDashboard();
  renderMyLearning();
}

// Main navigation between app sections.
function showView(view) {
  const views = {
    home: "homeView",
    study: "studyView",
    deck: "deckView",
    learning: "learningView"
  };

  if (!views[view]) return;

  Object.entries(views).forEach(([key, id]) => {
    const el = document.getElementById(id);

    if (el) {
      el.style.display = key === view
        ? (key === "deck" ? "flex" : "block")
        : "none";
    }
  });

  const navIds = {
    home: "navHome",
    study: "navStudy",
    deck: "navDeck",
    learning: "navLearning"
  };

  Object.values(navIds).forEach(id => {
    const button = document.getElementById(id);
    if (button) button.classList.remove("active");
  });

  const activeButton = document.getElementById(navIds[view]);

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (view === "learning") {
    renderMyLearning();
  }

  if (view === "home") {
    updateDashboard();
  }

  if (view === "deck") {
    renderCard();
  }

  window.scrollTo(0, 0);
}

// Compatibility with the older navigation function.
function switchMode(mode) {
  showView(mode === "deck" ? "deck" : "study");
}

function updateDashboard() {
  const completed = document.getElementById("homeCompletedCount");
  const saved = document.getElementById("homeSavedCount");
  const total = document.getElementById("homeTotalCount");

  if (completed) completed.textContent = completedChapters.length;
  if (saved) saved.textContent = bookmarks.length;
  if (total) total.textContent = chapters.length;
}

function renderMyLearning() {
  const completedEl = document.getElementById("learningCompleted");
  const savedEl = document.getElementById("learningSaved");
  const totalEl = document.getElementById("learningTotal");
  const container = document.getElementById("learningBookmarks");

  if (completedEl) completedEl.textContent = completedChapters.length;
  if (savedEl) savedEl.textContent = bookmarks.length;
  if (totalEl) totalEl.textContent = chapters.length;

  if (!container) return;

  const savedChapters = chapters.filter(ch =>
    bookmarks.includes(ch.id)
  );

  if (!savedChapters.length) {
    container.innerHTML = `
      <div class="card">
        <strong>No bookmarks yet.</strong>
        <p>Save chapters while studying and they will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = savedChapters.map(ch => `
    <div class="learning-bookmark-item">
      <div>
        <strong>${escapeHtml(getChapterTitle(ch))}</strong>
        <div class="verification-note">
          Class ${escapeHtml(getClassValue(ch))} •
          ${escapeHtml(getSubjectValue(ch))}
        </div>
      </div>
      <button type="button"
        onclick="openBookmarkedChapter('${escapeHtml(ch.id)}')">
        Open
      </button>
    </div>
  `).join("");
}

function openBookmarkedChapter(id) {
  const chapter = chapters.find(ch => String(ch.id) === String(id));

  if (!chapter) return;

  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const chapterSelect = document.getElementById("chapterSelect");

  if (!classSelect || !subjectSelect || !chapterSelect) return;

  classSelect.value = getClassValue(chapter);
  onClassChange();

  // Match the chapter subject with the available dropdown option.
  const desiredSubject = getSubjectValue(chapter);
  const subjectOption = [...subjectSelect.options].find(
    option => normalizeSubject(option.value) === normalizeSubject(desiredSubject)
  );

  if (subjectOption) {
    subjectSelect.value = subjectOption.value;
  }

  onSubjectChange();

  chapterSelect.value = String(chapter.id);
  onChapterChange();

  showView("study");
}

function setSubFilter(filter, btn) {
  document.querySelectorAll(".sub-tab").forEach(b => {
    b.classList.remove("active");
  });

  if (btn) btn.classList.add("active");

  subFilter = filter;
  renderNotes();
}

function getClassValue(ch) {
  return String(ch.class ?? ch.classLevel ?? "").trim();
}

function getSubjectValue(ch) {
  return String(ch.subject ?? "").trim();
}

function getChapterTitle(ch) {
  if (ch.chapter_title) return pickText(ch.chapter_title);

  return String(
    ch.chapter ?? ch.title ?? "Untitled Chapter"
  ).trim();
}

// Normalize subject names so Maths, Math and Mathematics match.
function normalizeSubject(subject) {
  const value = String(subject ?? "").trim().toLowerCase();

  if (["math", "maths", "mathematics"].includes(value)) {
    return "mathematics";
  }

  if (["science", "general science"].includes(value)) {
    return "science";
  }

  return value;
}

// Supports class_range and newer classLevel formula formats.
function formulaMatchesClass(formula, targetClass) {
  if (!targetClass) return false;

  return matchesClassFilter(
    formula.class_range ?? formula.classLevel ?? formula.class,
    targetClass
  );
}

function populateSubjects() {
  const subjectSelect = document.getElementById("subjectSelect");
  const chapterSelect = document.getElementById("chapterSelect");

  if (!subjectSelect || !chapterSelect) return;

  subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
  chapterSelect.innerHTML = `<option value="">All Chapters in Subject</option>`;

  chapterSelect.value = "";
  chapterSelect.disabled = true;
  selectedChapterId = "";

  if (!selectedClass) {
    subjectSelect.value = "";
    subjectSelect.disabled = true;
    selectedSubject = "";
    return;
  }

  const chapterSubjects = chapters
    .filter(ch => getClassValue(ch) === selectedClass)
    .map(ch => getSubjectValue(ch));

  const formulaSubjects = allFormulas
    .filter(f => formulaMatchesClass(f, selectedClass))
    .map(f => f.subject);

  const subjectMap = new Map();

  [...chapterSubjects, ...formulaSubjects]
    .filter(Boolean)
    .forEach(subject => {
      const key = normalizeSubject(subject);

      if (!key || subjectMap.has(key)) return;

      const chapterLabel = chapterSubjects.find(
        s => normalizeSubject(s) === key
      );

      const label = chapterLabel || (
        key === "mathematics" ? "Mathematics" :
        key === "science" ? "Science" :
        String(subject).trim()
      );

      subjectMap.set(key, label);
    });

  subjectMap.forEach(label => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    subjectSelect.appendChild(opt);
  });

  subjectSelect.disabled = subjectMap.size === 0;
  selectedSubject = "";
}

function populateChapters() {
  const chapterSelect = document.getElementById("chapterSelect");

  if (!chapterSelect) return;

  chapterSelect.innerHTML = `<option value="">All Chapters in Subject</option>`;
  selectedChapterId = "";

  if (!selectedClass || !selectedSubject) {
    chapterSelect.value = "";
    chapterSelect.disabled = true;
    return;
  }

  const matching = chapters.filter(
    ch => getClassValue(ch) === selectedClass &&
      normalizeSubject(getSubjectValue(ch)) === normalizeSubject(selectedSubject)
  );

  matching.forEach((ch, idx) => {
    const opt = document.createElement("option");
    opt.value = ch.id;

    const chNum = ch.chapter_number ?? (idx + 1);

    opt.textContent = `Ch. ${chNum}: ${getChapterTitle(ch)}`;

    chapterSelect.appendChild(opt);
  });

  chapterSelect.disabled = matching.length === 0;
}

function onClassChange() {
  const classSelect = document.getElementById("classSelect");
  if (!classSelect) return;

  selectedClass = classSelect.value;

  populateSubjects();
  renderNotes();
  resetDeck();
}

function onSubjectChange() {
  const subjectSelect = document.getElementById("subjectSelect");
  if (!subjectSelect) return;

  selectedSubject = subjectSelect.value;

  populateChapters();
  renderNotes();
  resetDeck();
}

function onChapterChange() {
  const chapterSelect = document.getElementById("chapterSelect");
  if (!chapterSelect) return;

  selectedChapterId = chapterSelect.value;
  renderNotes();
}

function toggleBookmark(id) {
  bookmarks = bookmarks.includes(id)
    ? bookmarks.filter(x => x !== id)
    : [...bookmarks, id];

  saveState(STORAGE_KEYS.bookmarks, bookmarks);

  updateProgress();
  renderNotes();
}

function toggleCompleted(id) {
  completedChapters = completedChapters.includes(id)
    ? completedChapters.filter(x => x !== id)
    : [...completedChapters, id];

  saveState(STORAGE_KEYS.completed, completedChapters);

  updateProgress();
  renderNotes();
}

function selectQuizAnswer(questionId, optionIndex) {
  activeQuizSelections[questionId] = optionIndex;
}

function submitChapterQuiz(chapterId) {
  const chapter = chapters.find(
    c => String(c.id) === String(chapterId)
  );

  if (!chapter || !Array.isArray(chapter.quiz) || !chapter.quiz.length) {
    return;
  }

  let score = 0;

  const results = chapter.quiz.map((q, idx) => {
    const chosen = activeQuizSelections[q.id];
    const isCorrect = chosen === q.correct_index;

    if (isCorrect) score++;

    return {
      index: idx + 1,
      isCorrect,
      explanation: pickText(q.explanation)
    };
  });

  quizHistory[chapter.id] = {
    score,
    total: chapter.quiz.length,
    savedAt: new Date().toISOString()
  };

  saveState(STORAGE_KEYS.quizHistory, quizHistory);

  const box = document.getElementById(`quiz-result-${chapter.id}`);

  if (box) {
    box.innerHTML = `
      <div><strong>Score: ${score} / ${chapter.quiz.length}</strong></div>
      ${results.map(r => `
        <div>
          Q${r.index}: ${r.isCorrect ? "Correct ✓" : "Review"}
          — ${escapeHtml(r.explanation)}
        </div>
      `).join("")}
    `;
  }

  updateProgress();
}

function getVerificationBadge(ver) {
  if (!ver) {
    return `<span class="status-pill review">REVIEW REQUIRED</span>`;
  }

  const qVerified = String(
    ver.question_bank_status || ""
  ).startsWith("VERIFIED");

  const knVerified = String(
    ver.kannada_translation_status || ""
  ).startsWith("VERIFIED");

  if (qVerified && knVerified) {
    return `<span class="status-pill verified">VERIFIED</span>`;
  }

  return `<span class="status-pill review">REVIEW REQUIRED</span>`;
}

function renderTopicBlock(topic) {
  const lm = topic.learning_material || {};

  const defs = Array.isArray(lm.important_definitions)
    ? lm.important_definitions : [];

  const notes = pickList(lm.chapter_notes);

  const keywords = Array.isArray(lm.important_keywords)
    ? lm.important_keywords : [];

  const examples = pickList(lm.real_life_examples);

  const exercises = Array.isArray(lm.practice_exercises)
    ? lm.practice_exercises : [];

  return `
    <section class="topic-block">
      <h3>${escapeHtml(pickText(topic.topic_title))}</h3>

      <p>
        <strong>Explanation:</strong>
        ${escapeHtml(pickText(lm.detailed_explanation))}
      </p>

      ${defs.length ? `
        <div>
          <strong>Important Definitions:</strong>
          <ul>
            ${defs.map(d => `
              <li>
                <strong>${escapeHtml(pickText(d.term))}:</strong>
                ${escapeHtml(pickText(d.definition))}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}

      ${notes.length ? `
        <div>
          <strong>Chapter Notes:</strong>
          <ul>
            ${notes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}

      ${keywords.length ? `
        <p>
          <strong>Keywords:</strong>
          ${keywords.map(k => escapeHtml(pickText(k))).join(" • ")}
        </p>
      ` : ""}

      ${examples.length ? `
        <div>
          <strong>Real-Life Examples:</strong>
          <ul>
            ${examples.map(ex => `<li>${escapeHtml(ex)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}

      ${pickText(lm.revision_notes) ? `
        <p>
          <strong>Revision Notes:</strong>
          ${escapeHtml(pickText(lm.revision_notes))}
        </p>
      ` : ""}

      ${exercises.length ? `
        <div>
          <strong>Practice Exercises:</strong>
          <ul>
            ${exercises.map(pe => `
              <li>
                ${escapeHtml(pickText(pe.prompt))}
                <div>
                  <em>
                    Answer Guide:
                    ${escapeHtml(pickText(pe.solution_guide))}
                  </em>
                </div>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
    </section>
  `;
}

function renderChapterCard(ch) {
  const isBookmarked = bookmarks.includes(ch.id);
  const isCompleted = completedChapters.includes(ch.id);

  const topics = Array.isArray(ch.topics) ? ch.topics : [];
  const qaList = Array.isArray(ch.important_qa) ? ch.important_qa : [];
  const quizList = Array.isArray(ch.quiz) ? ch.quiz : [];

  const prevQuiz = quizHistory[ch.id];
  const ver = ch.verification || {};

  return `
    <article class="card">
      <div class="top-meta">
        <span class="class-tag">
          Class ${escapeHtml(getClassValue(ch))} •
          ${escapeHtml(getSubjectValue(ch))} •
          Ch. ${escapeHtml(ch.chapter_number ?? "")}
        </span>

        ${getVerificationBadge(ver)}
      </div>

      <h2>${escapeHtml(getChapterTitle(ch))}</h2>

      ${pickText(ch.summary) ? `
        <p>
          <strong>Summary:</strong>
          ${escapeHtml(pickText(ch.summary))}
        </p>
      ` : ""}

      ${topics.map(renderTopicBlock).join("")}

      ${qaList.length ? `
        <div class="topic-block">
          <h3>Important Questions &amp; Answers</h3>

          ${qaList.map(item => `
            <div class="q-box">
              <strong>Q:</strong> ${escapeHtml(pickText(item.q))}
              <br/>
              <strong>A:</strong> ${escapeHtml(pickText(item.a))}
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${quizList.length ? `
        <div class="offline-quiz">
          <h3>
            Offline Practice Quiz
            ${prevQuiz ? `(Last Score: ${prevQuiz.score}/${prevQuiz.total})` : ""}
          </h3>

          ${quizList.map((q, qIdx) => `
            <div class="quiz-q">
              <div>
                <strong>
                  ${qIdx + 1}. ${escapeHtml(pickText(q.question))}
                </strong>
              </div>

              ${(q.options || []).map((opt, oIdx) => `
                <label class="quiz-option">
                  <input
                    type="radio"
                    name="quiz-${escapeHtml(ch.id)}-${escapeHtml(q.id)}"
                    onchange="selectQuizAnswer('${escapeHtml(q.id)}', ${oIdx})"
                  />
                  ${escapeHtml(pickText(opt))}
                </label>
              `).join("")}
            </div>
          `).join("")}

          <button
            type="button"
            class="act-btn"
            onclick="submitChapterQuiz('${escapeHtml(ch.id)}')"
          >
            Submit Quiz
          </button>

          <div
            id="quiz-result-${escapeHtml(ch.id)}"
            class="quiz-result"
          ></div>
        </div>
      ` : ""}

      <div class="card-actions">
        <button
          type="button"
          class="act-btn ${isBookmarked ? "saved" : ""}"
          onclick="toggleBookmark('${escapeHtml(ch.id)}')"
        >
          ${isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
        </button>

        <button
          type="button"
          class="act-btn ${isCompleted ? "done" : ""}"
          onclick="toggleCompleted('${escapeHtml(ch.id)}')"
        >
          ${isCompleted ? "✓ Completed" : "Mark Completed"}
        </button>
      </div>

      ${ver.textbook_reference ? `
        <div class="verification-note">
          Ref: ${escapeHtml(ver.textbook_reference)}
          (${escapeHtml(ver.academic_year || "")})
        </div>
      ` : ""}
    </article>
  `;
}

function renderNotes() {
  const searchInput = document.getElementById("searchInput");
  const container = document.getElementById("notesContainer");

  if (!container) return;

  const query = searchInput
    ? searchInput.value.toLowerCase().trim()
    : "";

  if (subFilter === "saved") {
    const savedList = chapters.filter(ch => {
      if (!bookmarks.includes(ch.id)) return false;

      if (selectedClass && getClassValue(ch) !== selectedClass) {
        return false;
      }

      if (
        selectedSubject &&
        normalizeSubject(getSubjectValue(ch)) !== normalizeSubject(selectedSubject)
      ) {
        return false;
      }

      if (selectedChapterId && String(ch.id) !== selectedChapterId) {
        return false;
      }

      if (query && !JSON.stringify(ch).toLowerCase().includes(query)) {
        return false;
      }

      return true;
    });

    if (!savedList.length) {
      container.innerHTML = `
        <div class="card">
          No bookmarked chapters match this filter yet.
        </div>
      `;
      return;
    }

    container.innerHTML = savedList.map(renderChapterCard).join("");
    return;
  }

  if (!selectedClass) {
    container.innerHTML = `
      <div class="card">
        <strong>Step 1:</strong>
        Select a <strong>Class (1–10)</strong> above to view available subjects.
      </div>
    `;
    return;
  }

  if (!selectedSubject) {
    const classSubjects = [...new Set(
      chapters
        .filter(ch => getClassValue(ch) === selectedClass)
        .map(getSubjectValue)
        .filter(Boolean)
    )];

    container.innerHTML = `
      <div class="card">
        <strong>Step 2:</strong>
        Choose a <strong>Subject</strong> for
        <strong>Class ${escapeHtml(selectedClass)}</strong>.

        ${classSubjects.length
          ? `<p>Available offline subjects: ${classSubjects.map(s => escapeHtml(s)).join(", ")}</p>`
          : `<p>No verified offline chapters added for Class ${escapeHtml(selectedClass)} yet.</p>`
        }
      </div>
    `;
    return;
  }

  const filtered = chapters.filter(ch => {
    if (getClassValue(ch) !== selectedClass) return false;

    if (
      normalizeSubject(getSubjectValue(ch)) !==
      normalizeSubject(selectedSubject)
    ) {
      return false;
    }

    if (selectedChapterId && String(ch.id) !== selectedChapterId) {
      return false;
    }

    if (query && !JSON.stringify(ch).toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="card">
        No chapters match this selection yet.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(renderChapterCard).join("");
}

function matchesClassFilter(classRangeOrLevel, targetClass) {
  if (!targetClass) return true;

  const target = Number(targetClass);
  const raw = String(classRangeOrLevel ?? "").trim();

  if (!raw) return true;

  if (/^\d+$/.test(raw)) {
    return Number(raw) === target;
  }

  const rangeMatch = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);

  if (rangeMatch) {
    return target >= Number(rangeMatch[1]) &&
      target <= Number(rangeMatch[2]);
  }

  return raw.split(",")
    .map(s => s.trim())
    .includes(String(target));
}

function resetDeck() {
  deck = allFormulas.filter(formula => {
    if (!formulaMatchesClass(formula, selectedClass)) return false;
    if (!selectedSubject) return false;

    return normalizeSubject(formula.subject) ===
      normalizeSubject(selectedSubject);
  });

  deckIndex = 0;
  mastered = 0;

  const masteredEl = document.getElementById("masteredCount");
  if (masteredEl) masteredEl.textContent = mastered;

  const flipEl = document.getElementById("flipCard");
  if (flipEl) flipEl.classList.remove("flipped");

  renderCard();
}

function renderCard() {
  const flipEl = document.getElementById("flipCard");

  if (!flipEl) return;

  flipEl.classList.remove("flipped");

  if (!deck.length) {
    const cardMeta = document.getElementById("cardMeta");
    const cardQ = document.getElementById("cardQ");
    const cardAns = document.getElementById("cardAns");
    const cardTip = document.getElementById("cardTip");
    const deckCounter = document.getElementById("deckCounter");

    if (cardMeta) {
      cardMeta.textContent = !selectedClass
        ? "Formula Deck"
        : !selectedSubject
          ? `Class ${selectedClass}`
          : `Class ${selectedClass} • ${selectedSubject}`;
    }

    if (cardQ) {
      cardQ.textContent = !selectedClass
        ? "Select a class to begin."
        : !selectedSubject
          ? "Now choose a subject."
          : "No formula cards for this selection yet.";
    }

    if (cardAns) cardAns.textContent = "—";

    if (cardTip) {
      cardTip.textContent = !selectedClass
        ? "Choose a class from the selection above."
        : !selectedSubject
          ? "Choose Mathematics or Science to see formula cards."
          : "Try another class or subject, or add more formula cards.";
    }

    if (deckCounter) deckCounter.textContent = "0 cards";

    return;
  }

  const item = deck[deckIndex];

  const classInfo = `Class ${selectedClass}`;
  const topicInfo = item.topic ? ` • ${item.topic}` : "";

  const tipParts = [
    item.explanation ?? item.tip,
    item.example ? `Example: ${item.example}` : ""
  ].filter(Boolean);

  const cardMeta = document.getElementById("cardMeta");
  const cardQ = document.getElementById("cardQ");
  const cardAns = document.getElementById("cardAns");
  const cardTip = document.getElementById("cardTip");
  const deckCounter = document.getElementById("deckCounter");

  if (cardMeta) {
    cardMeta.textContent =
      `${classInfo} • ${item.subject ?? ""}${topicInfo}`;
  }

  if (cardQ) {
    cardQ.textContent = item.title ?? item.q ?? "Formula Card";
  }

  if (cardAns) cardAns.textContent = item.formula ?? "";

  if (cardTip) cardTip.textContent = tipParts.join(" — ");

  if (deckCounter) {
    deckCounter.textContent = `Card ${deckIndex + 1} of ${deck.length}`;
  }
}

function flipCard() {
  if (deck.length) {
    const flipEl = document.getElementById("flipCard");

    if (flipEl) {
      flipEl.classList.toggle("flipped");
    }
  }
}

function rateCard(gotIt) {
  if (!deck.length) return;

  if (gotIt) {
    mastered++;
    
    const masteredEl = document.getElementById("masteredCount");
    if (masteredEl) masteredEl.textContent = mastered;

    deck.splice(deckIndex, 1);

    if (deckIndex >= deck.length) {
      deckIndex = 0;
    }
  } else {
    const missed = deck.splice(deckIndex, 1)[0];
    deck.push(missed);

    if (deckIndex >= deck.length) {
      deckIndex = 0;
    }
  }

  renderCard();
}

// Start the app.
loadData();
