const STORAGE_KEY = "goalie-games-v1";

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

let games = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let currentGameId = null;

function saveGames() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

function setDefaultValues() {
  const today = new Date();
  refs.date.value = today.toISOString().split("T")[0];
  refs.season.value = String(today.getFullYear());
  refs.saves.value = "0";
  refs.goalsAllowed.value = "0";
  refs.pkSaves.value = "0";
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
          <button type="button" class="delete-btn" data-delete="${game.id}">Delete</button>
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

function autoSaveCurrentGame() {
  const game = getFormData();
  const error = validateGame(game);

  if (error) {
    refs.status.textContent = `Auto-save waiting: ${error}`;
    refs.status.className = "status invalid";
    return;
  }

  currentGameId = game.id;
  upsertGame(game);
  saveGames();
  refs.status.textContent = "Auto-saved.";
  refs.status.className = "status valid";
  renderAll();
}

function incrementField(fieldId) {
  const input = refs[fieldId];
  if (!input) return;
  const nextValue = Number(input.value || "0") + 1;
  input.value = String(nextValue);
  autoSaveCurrentGame();
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
  autoSaveCurrentGame();
});

refs.form.addEventListener("submit", (event) => {
  event.preventDefault();
  autoSaveCurrentGame();

  if (!currentGameId) return;

  refs.form.reset();
  currentGameId = null;
  setDefaultValues();
  refs.status.textContent = "Game finalized. Ready for a new game.";
  refs.status.className = "status valid";
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

  const id = Number(target.dataset.delete);
  if (!id) return;

  games = games.filter((game) => game.id !== id);
  if (id === currentGameId) currentGameId = null;
  saveGames();
  renderAll();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

setDefaultValues();
renderAll();
