const saveBtn = document.getElementById("saveBtn");
const addSectionBtn = document.getElementById("addSectionBtn");
const sectionInput = document.getElementById("sectionInput");
const sectionSelect = document.getElementById("sectionSelect");
const addLinesBtn = document.getElementById("addLinesBtn");
const linesInput = document.getElementById("linesInput");
const songTitleInput = document.getElementById("songTitle");
const lineEditor = document.getElementById("lineEditor");
const tabSheet = document.getElementById("tabSheet");
const previewTitle = document.getElementById("previewTitle");
const savedSongsList = document.getElementById("savedSongs");
const chordModal = document.getElementById("chordModal");
const chordSearch = document.getElementById("chordSearch");
const recommendations = document.getElementById("recommendations");
const closeModalBtn = document.getElementById("closeModalBtn");
const clearChordBtn = document.getElementById("clearChordBtn");

const STORAGE_KEY = "soundshack_songs";
const CHORD_POOL = [
  "A",
  "Am",
  "A#",
  "A#m",
  "B",
  "Bm",
  "C",
  "Cm",
  "C#",
  "C#m",
  "D",
  "Dm",
  "D#",
  "D#m",
  "E",
  "Em",
  "F",
  "Fm",
  "F#",
  "F#m",
  "G",
  "Gm",
  "G#",
  "G#m",
];

let songDraft = { title: "", sections: [] };
let activeSlotTarget = null;

function captureHorizontalScroll(container, selector) {
  const scrollState = {};
  container.querySelectorAll(selector).forEach((node) => {
    const key = node.dataset.scrollKey;
    if (key) {
      scrollState[key] = node.scrollLeft;
    }
  });
  return scrollState;
}

function restoreHorizontalScroll(container, selector, scrollState) {
  container.querySelectorAll(selector).forEach((node) => {
    const key = node.dataset.scrollKey;
    if (key && Object.prototype.hasOwnProperty.call(scrollState, key)) {
      node.scrollLeft = scrollState[key];
    }
  });
}

function sanitizeChordName(chord) {
  return chord.replace(/#/g, "sharp").replace(/\//g, "_").replace(/\s+/g, "");
}

function chordImagePath(chord) {
  return `assets/${sanitizeChordName(chord)}.jpg`;
}

function chordChartImagePath(chord) {
  return `./Resource/Guitar/${chord}.png`;
}

function requiredSlotCount(lyrics = "") {
  const charCount = lyrics.length;
  if (charCount === 0) return 6;
  return Math.min(40, Math.max(6, Math.ceil(charCount / 3)));
}

function ensureLineShape(line) {
  const lyrics = line.lyrics || "";
  const slotCount = requiredSlotCount(lyrics);
  const positions = Array.isArray(line.positions) ? line.positions.slice(0, slotCount) : [];
  while (positions.length < slotCount) positions.push("");
  return { lyrics, positions };
}

function ensureSectionShape(section, index) {
  const lines = Array.isArray(section.lines) ? section.lines.map(ensureLineShape) : [];
  return {
    name: section.name || `Section ${index + 1}`,
    collapsed: Boolean(section.collapsed),
    lines,
  };
}

function hydrateSong(song) {
  const sections = Array.isArray(song.sections)
    ? song.sections.map(ensureSectionShape)
    : [];
  return { title: song.title || "", sections };
}

function updateSectionSelect() {
  sectionSelect.innerHTML = "";
  songDraft.sections.forEach((section, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = section.name;
    sectionSelect.appendChild(option);
  });
}

function addSection() {
  const name = sectionInput.value.trim() || `Section ${songDraft.sections.length + 1}`;
  songDraft.sections.push({ name, collapsed: false, lines: [] });
  sectionInput.value = "";
  updateSectionSelect();
  sectionSelect.value = String(songDraft.sections.length - 1);
  renderEditor();
  renderTabSheet();
}

function addMultipleLines() {
  const selected = Number(sectionSelect.value);
  if (Number.isNaN(selected) || !songDraft.sections[selected]) return;
  const lines = linesInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((lyrics) => ({ lyrics, positions: Array(requiredSlotCount(lyrics)).fill("") }));
  if (!lines.length) return;
  songDraft.sections[selected].lines.push(...lines);
  linesInput.value = "";
  renderEditor();
  renderTabSheet();
}

function removeSection(sectionIndex) {
  songDraft.sections.splice(sectionIndex, 1);
  updateSectionSelect();
  renderEditor();
  renderTabSheet();
}

function toggleSection(sectionIndex) {
  songDraft.sections[sectionIndex].collapsed = !songDraft.sections[sectionIndex].collapsed;
  renderEditor();
}

function removeLine(sectionIndex, lineIndex) {
  songDraft.sections[sectionIndex].lines.splice(lineIndex, 1);
  renderEditor();
  renderTabSheet();
}

function openChordModal(slotBtn) {
  activeSlotTarget = slotBtn;
  chordSearch.value = slotBtn.textContent === "+" ? "" : slotBtn.textContent;
  renderSuggestions(chordSearch.value);
  chordModal.classList.remove("hidden");
  chordSearch.focus();
}

function closeChordModal() {
  activeSlotTarget = null;
  chordModal.classList.add("hidden");
}

function applyChord(chord) {
  if (!activeSlotTarget) return;
  const sectionIndex = Number(activeSlotTarget.dataset.section);
  const lineIndex = Number(activeSlotTarget.dataset.line);
  const slotIndex = Number(activeSlotTarget.dataset.slot);
  const line = songDraft.sections[sectionIndex].lines[lineIndex];
  songDraft.sections[sectionIndex].lines[lineIndex] = ensureLineShape(line);
  songDraft.sections[sectionIndex].lines[lineIndex].positions[slotIndex] = chord;
  closeChordModal();
  renderEditor();
  renderTabSheet();
}

function clearChord() {
  if (!activeSlotTarget) return;
  const sectionIndex = Number(activeSlotTarget.dataset.section);
  const lineIndex = Number(activeSlotTarget.dataset.line);
  const slotIndex = Number(activeSlotTarget.dataset.slot);
  const line = songDraft.sections[sectionIndex].lines[lineIndex];
  songDraft.sections[sectionIndex].lines[lineIndex] = ensureLineShape(line);
  songDraft.sections[sectionIndex].lines[lineIndex].positions[slotIndex] = "";
  closeChordModal();
  renderEditor();
  renderTabSheet();
}

function chordSuggestions(query) {
  if (!query) return CHORD_POOL.slice(0, 10);
  const q = query.toLowerCase();
  const starts = CHORD_POOL.filter((ch) => ch.toLowerCase().startsWith(q));
  const includes = CHORD_POOL.filter(
    (ch) => ch.toLowerCase().includes(q) && !starts.includes(ch),
  );
  return [...starts, ...includes].slice(0, 10);
}

function renderSuggestions(query = "") {
  recommendations.innerHTML = "";
  chordSuggestions(query).forEach((chord) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recommendation";
    button.textContent = chord;
    button.addEventListener("click", () => applyChord(chord));
    recommendations.appendChild(button);
  });
}

function renderEditor() {
  const editorScrollTop = lineEditor.scrollTop;
  const lineScrollState = captureHorizontalScroll(lineEditor, ".line-scroll");
  lineEditor.innerHTML = "";
  songDraft.sections.forEach((rawSection, sectionIndex) => {
    const section = ensureSectionShape(rawSection, sectionIndex);
    songDraft.sections[sectionIndex] = section;

    const card = document.createElement("article");
    card.className = "section-card";

    const toolbar = document.createElement("div");
    toolbar.className = "section-toolbar";

    const title = document.createElement("span");
    title.className = "section-title";
    title.textContent = section.name;

    const actions = document.createElement("div");
    actions.className = "section-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "secondary";
    toggleBtn.textContent = section.collapsed ? "Expand" : "Collapse";
    toggleBtn.addEventListener("click", () => toggleSection(sectionIndex));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "secondary danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => removeSection(sectionIndex));

    actions.append(toggleBtn, deleteBtn);
    toolbar.append(title, actions);
    card.appendChild(toolbar);

    if (!section.collapsed) {
      const linesWrap = document.createElement("div");
      linesWrap.className = "section-lines";

      section.lines.forEach((line, lineIndex) => {
        const normalized = ensureLineShape(line);
        section.lines[lineIndex] = normalized;

        const lineCard = document.createElement("article");
        lineCard.className = "line-card";

        const lineToolbar = document.createElement("div");
        lineToolbar.className = "line-toolbar";

        const lineNumber = document.createElement("span");
        lineNumber.className = "line-number";
        lineNumber.textContent = `Line ${lineIndex + 1}`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "secondary";
        removeBtn.textContent = "Delete";
        removeBtn.addEventListener("click", () => removeLine(sectionIndex, lineIndex));

        lineToolbar.append(lineNumber, removeBtn);

        const positionGrid = document.createElement("div");
        const slotCount = normalized.positions.length;
        const gridWidth = `${slotCount * 32}px`;
        const lineScroll = document.createElement("div");
        lineScroll.className = "line-scroll";
        lineScroll.dataset.scrollKey = `editor-${sectionIndex}-${lineIndex}`;
        positionGrid.className = "position-grid";
        positionGrid.style.gridTemplateColumns = `repeat(${slotCount}, 28px)`;
        positionGrid.style.minWidth = gridWidth;
        normalized.positions.forEach((chord, slotIndex) => {
          const slotBtn = document.createElement("button");
          slotBtn.type = "button";
          slotBtn.className = `slot-btn ${chord ? "filled" : ""}`;
          slotBtn.textContent = chord || "+";
          slotBtn.dataset.section = String(sectionIndex);
          slotBtn.dataset.line = String(lineIndex);
          slotBtn.dataset.slot = String(slotIndex);
          slotBtn.addEventListener("click", () => openChordModal(slotBtn));
          positionGrid.appendChild(slotBtn);
        });

        const lyrics = document.createElement("p");
        lyrics.className = "line-lyrics";
        lyrics.textContent = normalized.lyrics;
        lyrics.style.minWidth = gridWidth;

        lineScroll.append(positionGrid, lyrics);
        lineCard.append(lineToolbar, lineScroll);
        linesWrap.appendChild(lineCard);
      });

      card.appendChild(linesWrap);
    }

    lineEditor.appendChild(card);
  });
  lineEditor.scrollTop = editorScrollTop;
  restoreHorizontalScroll(lineEditor, ".line-scroll", lineScrollState);
}

function renderTabSheet() {
  const tabScrollTop = tabSheet.scrollTop;
  const tabLineScrollState = captureHorizontalScroll(tabSheet, ".tab-line-scroll");
  tabSheet.innerHTML = "";
  previewTitle.textContent = songDraft.title || "Live Preview";

  const allChords = new Set();
  songDraft.sections.forEach((rawSection, sectionIndex) => {
    const section = ensureSectionShape(rawSection, sectionIndex);
    section.lines.forEach((line) => {
      ensureLineShape(line).positions.forEach((chord) => {
        if (chord) allChords.add(chord);
      });
    });
  });

  if (allChords.size > 0) {
    const chartBar = document.createElement("section");
    chartBar.className = "chord-chart-bar";

    const chartTitle = document.createElement("h3");
    chartTitle.className = "chord-chart-title";
    chartTitle.textContent = "Chords";
    chartBar.appendChild(chartTitle);

    const chartList = document.createElement("div");
    chartList.className = "chord-chart-list";

    [...allChords].forEach((chord) => {
      const card = document.createElement("div");
      card.className = "chord-chart-item";

      const img = document.createElement("img");
      img.className = "chord-chart-image";
      img.alt = `${chord} chord chart`;
      img.src = chordChartImagePath(chord);

      const label = document.createElement("div");
      label.className = "chord-chart-label";
      label.textContent = chord;

      card.append(img, label);
      chartList.appendChild(card);
    });

    chartBar.appendChild(chartList);
    tabSheet.appendChild(chartBar);
  }

  songDraft.sections.forEach((rawSection, sectionIndex) => {
    const section = ensureSectionShape(rawSection, sectionIndex);
    const sectionWrap = document.createElement("section");

    const sectionHeading = document.createElement("h3");
    sectionHeading.className = "section-heading";
    sectionHeading.textContent = `<${section.name}>`;
    sectionWrap.appendChild(sectionHeading);

    section.lines.forEach((line, lineIndex) => {
      const normalized = ensureLineShape(line);
      const lineWrap = document.createElement("article");
      lineWrap.className = "tab-line";
      const slotCount = normalized.positions.length;
      const gridWidth = `${slotCount * 32}px`;
      const tabLineScroll = document.createElement("div");
      tabLineScroll.className = "tab-line-scroll";
      tabLineScroll.dataset.scrollKey = `preview-${sectionIndex}-${lineIndex}`;

      const chordGrid = document.createElement("div");
      chordGrid.className = "preview-chord-grid";
      chordGrid.style.gridTemplateColumns = `repeat(${slotCount}, 28px)`;
      chordGrid.style.minWidth = gridWidth;
      normalized.positions.forEach((chord) => {
        const slot = document.createElement("div");
        slot.className = chord ? "preview-chord" : "preview-slot";
        slot.textContent = chord || "";
        chordGrid.appendChild(slot);
      });

      const lyricsRow = document.createElement("div");
      lyricsRow.className = "preview-lyrics";
      lyricsRow.textContent = normalized.lyrics;
      lyricsRow.style.minWidth = gridWidth;

      const usedChords = [...new Set(normalized.positions.filter(Boolean))];
      const diagramRow = document.createElement("div");
      diagramRow.className = "diagram-row";
      usedChords.forEach((chord) => {
        const img = document.createElement("img");
        img.className = "diagram";
        img.alt = `${chord} chord diagram`;
        img.src = chordImagePath(chord);
        img.onerror = () => {
          img.style.display = "none";
        };
        diagramRow.appendChild(img);
      });

      tabLineScroll.append(chordGrid, lyricsRow);
      lineWrap.append(tabLineScroll, diagramRow);
      sectionWrap.appendChild(lineWrap);
    });

    tabSheet.appendChild(sectionWrap);
  });
  tabSheet.scrollTop = tabScrollTop;
  restoreHorizontalScroll(tabSheet, ".tab-line-scroll", tabLineScrollState);
}

function loadSongs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse saved songs:", error);
    return [];
  }
}

function saveSongs(songs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function deleteSavedSong(index) {
  const songs = loadSongs();
  if (index < 0 || index >= songs.length) return;
  songs.splice(index, 1);
  saveSongs(songs);
  renderSavedSongs();
}

function renderSavedSongs() {
  const songs = loadSongs();
  savedSongsList.innerHTML = "";
  songs.forEach((song, idx) => {
    const li = document.createElement("li");
    li.className = "saved-item";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = song.title || `Song ${idx + 1}`;
    openBtn.addEventListener("click", () => {
      songDraft = hydrateSong(song);
      songTitleInput.value = songDraft.title;
      updateSectionSelect();
      renderEditor();
      renderTabSheet();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "secondary danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteSavedSong(idx));

    li.append(openBtn, deleteBtn);
    savedSongsList.appendChild(li);
  });
}

addSectionBtn.addEventListener("click", addSection);
addLinesBtn.addEventListener("click", addMultipleLines);
saveBtn.addEventListener("click", () => {
  songDraft.title = songTitleInput.value.trim() || "Untitled Song";
  const songs = loadSongs();
  songs.unshift({
    title: songDraft.title,
    sections: songDraft.sections.map((section, index) => ensureSectionShape(section, index)),
  });
  saveSongs(songs);
  renderSavedSongs();
});

closeModalBtn.addEventListener("click", closeChordModal);
clearChordBtn.addEventListener("click", clearChord);
chordSearch.addEventListener("input", (event) => renderSuggestions(event.target.value));
chordSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const best = chordSuggestions(chordSearch.value)[0];
    if (best) applyChord(best);
  }
});
chordModal.addEventListener("click", (event) => {
  if (event.target === chordModal) closeChordModal();
});
songTitleInput.addEventListener("input", () => {
  songDraft.title = songTitleInput.value.trim();
  renderTabSheet();
});

songDraft = { title: "", sections: [] };
updateSectionSelect();
renderEditor();
renderTabSheet();
renderSavedSongs();
