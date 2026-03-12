const STORAGE_KEY = "goalie-games-v1";
const DRAFT_KEY = "goalie-draft-v1";
const API_URL = "/.netlify/functions/games";

const refs = {
  form: document.getElementById("gameForm"),
  status: document.getElementById("formStatus"),
  date: document.getElementById("gameDate"),
  season: document.getElementById("season"),
  teamLevel: document.getElementById("teamLevel"),
  opponent: document.getElementById("opponent"),
  saves: document.getElementById("saves"),
  goalsAllowed: document.getElementById("goalsAllowed"),
  pkSaves: document.getElementById("pkSaves"),
  notes: document.getElementById("notes"),
  seasonFilter: document.getElementById("seasonFilter"),
  levelFilter: document.getElementById("levelFilter"),
  summary: document.getElementById("summary"),
  gameList: document.getElementById("gameList"),
  seasonView: document.getElementById("seasonView"),
  toggleSeasonViewBtn: document.getElementById("toggleSeasonViewBtn"),
};

let currentGameId = null;
let autosaveTimer = null;
let syncTimer = null;

function parseStoredJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

let games = parseStoredJSON(STORAGE_KEY, []);
if (!Array.isArray(games)) {
  games = [];
}

/* ── Server sync ── */

function syncToServer() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(games),
    }).catch(() => {});
  }, 800);
}

async function loadGamesFromServer() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("fetch failed");
    const serverGames = await res.json();

    if (Array.isArray(serverGames) && serverGames.length > 0) {
      games = serverGames;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } else if (games.length > 0) {
      syncToServer();
    }
  } catch {
    /* offline or error — keep using localStorage data */
  }
  renderAll();
}

/* ── Local persistence ── */

function saveGames() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  syncToServer();
}

function clearAutosaveTimer() {
  if (!autosaveTimer) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
}

function saveDraft() {
  const draft = {
    id: currentGameId,
    gameDate: refs.date.value,
    season: refs.season.value,
    teamLevel: refs.teamLevel.value,
    opponent: refs.opponent.value,
    saves: refs.saves.value,
    goalsAllowed: refs.goalsAllowed.value,
    pkSaves: refs.pkSaves.value,
    notes: refs.notes.value,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function setDefaultValues() {
  const today = new Date();
  refs.date.value = today.toISOString().split("T")[0];
  refs.season.value = String(today.getFullYear());
  refs.teamLevel.value = "Club";
  refs.saves.value = "0";
  refs.goalsAllowed.value = "0";
  refs.pkSaves.value = "0";
  refs.opponent.value = "";
  refs.notes.value = "";
}

function restoreDraftOrDefault() {
  const draft = parseStoredJSON(DRAFT_KEY, null);
  if (!draft || typeof draft !== "object") {
    setDefaultValues();
    return;
  }

  currentGameId = Number(draft.id) || null;
  refs.date.value = draft.gameDate || "";
  refs.season.value = draft.season || "";
  refs.teamLevel.value = draft.teamLevel || "Club";
  refs.opponent.value = draft.opponent || "";
  refs.saves.value = draft.saves || "0";
  refs.goalsAllowed.value = draft.goalsAllowed || "0";
  refs.pkSaves.value = draft.pkSaves || "0";
  refs.notes.value = draft.notes || "";
}

function loadGameIntoForm(game) {
  currentGameId = game.id;
  refs.date.value = game.gameDate;
  refs.season.value = String(game.season);
  refs.teamLevel.value = game.teamLevel;
  refs.opponent.value = game.opponent;
  refs.saves.value = String(game.saves);
  refs.goalsAllowed.value = String(game.goalsAllowed);
  refs.pkSaves.value = String(game.pkSaves || 0);
  refs.notes.value = game.notes || "";
  saveDraft();
  setStatus(`Editing ${game.teamLevel} vs ${game.opponent}.`, "pending");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getFormData() {
  return {
    id: currentGameId || Date.now(),
    gameDate: refs.date.value,
    season: Number(refs.season.value),
    teamLevel: refs.teamLevel.value,
    opponent: refs.opponent.value.trim(),
    saves: Number(refs.saves.value),
    goalsAllowed: Number(refs.goalsAllowed.value),
    pkSaves: Number(refs.pkSaves.value),
    notes: refs.notes.value.trim(),
  };
}

function validateGame(game) {
  if (!game.gameDate) return "Date is required.";
  if (!Number.isInteger(game.season) || game.season < 2000 || game.season > 2100) {
    return "Season must be a year between 2000 and 2100.";
  }
  if (!game.opponent) return "Opponent is required.";
  if (!Number.isInteger(game.saves) || game.saves < 0) return "Saves must be 0 or more.";
  if (!Number.isInteger(game.goalsAllowed) || game.goalsAllowed < 0) return "Goals allowed must be 0 or more.";
  if (!Number.isInteger(game.pkSaves) || game.pkSaves < 0) return "PK saves must be 0 or more.";
  return "";
}

function getUniqueSeasons() {
  return [...new Set(games.map((game) => game.season))].sort((a, b) => b - a);
}

function renderSeasonFilter() {
  const seasons = getUniqueSeasons();
  const selected = refs.seasonFilter.value;

  refs.seasonFilter.innerHTML = [
    '<option value="all">All Seasons</option>',
    ...seasons.map((season) => `<option value="${season}">${season}</option>`),
  ].join("");

  refs.seasonFilter.value = seasons.includes(Number(selected)) ? selected : "all";
}

function getFilteredGames() {
  const seasonValue = refs.seasonFilter.value;
  const levelValue = refs.levelFilter.value;

  return games
    .filter((game) => (seasonValue === "all" ? true : String(game.season) === seasonValue))
    .filter((game) => (levelValue === "all" ? true : game.teamLevel === levelValue))
    .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());
}

function calculateSummary(filteredGames) {
  const totals = filteredGames.reduce(
    (acc, game) => {
      acc.saves += game.saves;
      acc.goalsAllowed += game.goalsAllowed;
      acc.pkSaves += game.pkSaves || 0;
      return acc;
    },
    { saves: 0, goalsAllowed: 0, pkSaves: 0 },
  );

  const totalSaves = totals.saves + totals.pkSaves;
  const shotsOnGoal = totalSaves + totals.goalsAllowed;
  const savePct = shotsOnGoal > 0 ? (totalSaves / shotsOnGoal) * 100 : 0;

  return {
    games: filteredGames.length,
    saves: totals.saves,
    pkSaves: totals.pkSaves,
    totalSaves,
    goalsAllowed: totals.goalsAllowed,
    shotsOnGoal,
    savePct,
  };
}

function renderSummary(filteredGames) {
  const summary = calculateSummary(filteredGames);
  refs.summary.innerHTML = `
    <div class="summary-grid">
      <div><span class="label">Games</span><strong>${summary.games}</strong></div>
      <div><span class="label">Saves</span><strong>${summary.saves}</strong></div>
      <div><span class="label">PK Saves</span><strong>${summary.pkSaves}</strong></div>
      <div><span class="label">Total Saves</span><strong>${summary.totalSaves}</strong></div>
      <div><span class="label">Goals Allowed</span><strong>${summary.goalsAllowed}</strong></div>
      <div><span class="label">Shots on Goal</span><strong>${summary.shotsOnGoal}</strong></div>
      <div><span class="label">Save %</span><strong>${summary.savePct.toFixed(1)}%</strong></div>
    </div>
  `;
}

function renderGames(filteredGames) {
  if (!filteredGames.length) {
    refs.gameList.innerHTML = "<p>No games match this view yet.</p>";
    return;
  }

  refs.gameList.innerHTML = filteredGames
    .map((game) => {
      const pkSaves = game.pkSaves || 0;
      const totalSaves = game.saves + pkSaves;
      const gameSavePct = ((totalSaves / Math.max(totalSaves + game.goalsAllowed, 1)) * 100).toFixed(1);

      return `
      <article class="game-card" data-id="${game.id}">
        <div class="card-head">
          <h3>${game.teamLevel} vs ${game.opponent}</h3>
          <div class="card-actions">
            <button type="button" class="edit-btn" data-edit="${game.id}">Edit</button>
            <button type="button" class="delete-btn" data-delete="${game.id}">Delete</button>
          </div>
        </div>
        <p><strong>Date:</strong> ${game.gameDate}</p>
        <p><strong>Season:</strong> ${game.season}</p>
        <p><strong>Saves:</strong> ${game.saves} | <strong>PK Saves:</strong> ${pkSaves} | <strong>Total Saves:</strong> ${totalSaves}</p>
        <p><strong>Goals Allowed:</strong> ${game.goalsAllowed}</p>
        <p><strong>Save %:</strong> ${gameSavePct}%</p>
        ${game.notes ? `<p><strong>Notes:</strong> ${game.notes}</p>` : ""}
      </article>
    `;
    })
    .join("");
}

function renderAll() {
  renderSeasonFilter();
  const filtered = getFilteredGames();
  renderSummary(filtered);
  renderGames(filtered);
}

function upsertGame(game) {
  const existingIndex = games.findIndex((entry) => entry.id === game.id);
  if (existingIndex === -1) {
    games.unshift(game);
    return;
  }
  games[existingIndex] = game;
}

function setStatus(message, type) {
  refs.status.textContent = message;
  refs.status.className = `status ${type}`;
}

function autoSaveCurrentGame(showError = false) {
  saveDraft();

  const game = getFormData();
  const error = validateGame(game);

  if (error) {
    if (showError) {
      setStatus(`Auto-save waiting: ${error}`, "invalid");
    } else {
      setStatus("Editing draft\u2026", "pending");
    }
    return false;
  }

  currentGameId = game.id;
  upsertGame(game);
  saveGames();
  saveDraft();
  setStatus("Auto-saved.", "valid");
  renderAll();
  return true;
}

function scheduleAutoSave(showError = false) {
  clearAutosaveTimer();
  autosaveTimer = setTimeout(() => {
    autoSaveCurrentGame(showError);
    autosaveTimer = null;
  }, 250);
}

function incrementField(fieldId) {
  const input = refs[fieldId];
  if (!input) return;
  const nextValue = Number(input.value || "0") + 1;
  input.value = String(nextValue);
  clearAutosaveTimer();
  autoSaveCurrentGame(true);
}

refs.form.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const fieldId = target.dataset.inc;
  if (!fieldId) return;

  incrementField(fieldId);
});

refs.form.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.inc) return;
  scheduleAutoSave(false);
});

refs.form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearAutosaveTimer();
  const saved = autoSaveCurrentGame(true);
  if (!saved) return;

  refs.form.reset();
  currentGameId = null;
  clearDraft();
  setDefaultValues();
  setStatus("Game finalized. Ready for a new game.", "valid");
});

refs.toggleSeasonViewBtn.addEventListener("click", () => {
  const isHidden = refs.seasonView.classList.toggle("hidden");
  refs.toggleSeasonViewBtn.textContent = isHidden ? "Show Season View" : "Hide Season View";
});

refs.levelFilter.addEventListener("change", renderAll);
refs.seasonFilter.addEventListener("change", renderAll);

refs.gameList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editId = Number(target.dataset.edit);
  if (editId) {
    const game = games.find((entry) => entry.id === editId);
    if (!game) return;
    loadGameIntoForm(game);
    return;
  }

  const deleteId = Number(target.dataset.delete);
  if (!deleteId) return;

  games = games.filter((game) => game.id !== deleteId);
  if (deleteId === currentGameId) {
    currentGameId = null;
    clearDraft();
    clearAutosaveTimer();
    setDefaultValues();
    setStatus("Edit removed. Ready for a new game.", "pending");
  }
  saveGames();
  renderAll();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if (!window.caches) return;
        return caches
          .keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("goalie-tracker-cache-")).map((key) => caches.delete(key))));
      })
      .catch(() => {});
  });
}

/* ── Startup ── */
restoreDraftOrDefault();
renderAll();
autoSaveCurrentGame(false);
loadGamesFromServer();
