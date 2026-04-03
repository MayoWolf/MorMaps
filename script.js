const state = {
  tool: "pen",
  strokeColor: randomHexColor(),
  strokeWidth: 5,
  drawAlliance: "red",
  strokes: [],
  markers: [],
  steps: [],
  selectedMarkerId: null,
  activeStroke: null,
  activeMarkerDrag: null,
  pointerMap: new Map(),
  tba: {
    eventKey: "2026caasv",
    teams: [],
    filteredTeams: [],
    matches: [],
    isLoading: false,
  },
  playback: {
    isPlaying: false,
    frame: 0,
    stopRequested: false,
    resolveCurrentStep: null,
    lastRendered: {
      markers: [],
      strokes: [],
    },
  },
};

const els = {
  field: document.getElementById("field"),
  canvas: document.getElementById("drawing-layer"),
  markerLayer: document.getElementById("marker-layer"),
  tbaEventKey: document.getElementById("tba-event-key"),
  loadTbaTeams: document.getElementById("load-tba-teams"),
  refreshTbaTeams: document.getElementById("refresh-tba-teams"),
  tbaTeamSearch: document.getElementById("tba-team-search"),
  tbaStatus: document.getElementById("tba-status"),
  tbaTeamList: document.getElementById("tba-team-list"),
  tbaTeamCount: document.getElementById("tba-team-count"),
  tbaMatchList: document.getElementById("tba-match-list"),
  tbaMatchCount: document.getElementById("tba-match-count"),
  removeMarker: document.getElementById("remove-marker"),
  clearDrawing: document.getElementById("clear-drawing"),
  resetBoard: document.getElementById("reset-board"),
  toolPen: document.getElementById("tool-pen"),
  toolEraser: document.getElementById("tool-eraser"),
  drawRed: document.getElementById("draw-red"),
  drawBlue: document.getElementById("draw-blue"),
  strokeColor: document.getElementById("stroke-color"),
  randomizeStroke: document.getElementById("randomize-stroke"),
  strokeWidth: document.getElementById("stroke-width"),
  addStep: document.getElementById("add-step"),
  playSequence: document.getElementById("play-sequence"),
  pauseSequence: document.getElementById("pause-sequence"),
  timelineList: document.getElementById("timeline-list"),
  stepName: document.getElementById("step-name"),
  stepDuration: document.getElementById("step-duration"),
  stepDurationLabel: document.getElementById("step-duration-label"),
  statusPill: document.getElementById("status-pill"),
  timelineTemplate: document.getElementById("timeline-item-template"),
};

const ctx = els.canvas.getContext("2d");
const TBA_EVENT_STORAGE_KEY = "mormaps.tba.eventKey";
const ALLIANCE_OUTLINES = {
  red: "#dc2626",
  blue: "#2563eb",
};
const MATCH_START_POSITIONS = {
  red: [
    { x: 0.18, y: 0.25 },
    { x: 0.18, y: 0.5 },
    { x: 0.18, y: 0.75 },
  ],
  blue: [
    { x: 0.82, y: 0.25 },
    { x: 0.82, y: 0.5 },
    { x: 0.82, y: 0.75 },
  ],
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomHexColor() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}

function outlineColorForAlliance(alliance) {
  return ALLIANCE_OUTLINES[alliance] || ALLIANCE_OUTLINES.red;
}

function setTbaStatus(message, isError = false) {
  els.tbaStatus.textContent = message;
  els.tbaStatus.style.color = isError ? "#b91c1c" : "";
}

function saveTbaSettings() {
  localStorage.setItem(TBA_EVENT_STORAGE_KEY, state.tba.eventKey);
}

function readStoredTbaSettings() {
  state.tba.eventKey = localStorage.getItem(TBA_EVENT_STORAGE_KEY) || "2026caasv";
  els.tbaEventKey.value = state.tba.eventKey;
}

function assignTeamColor(teamNumber) {
  const palette = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
  ];
  return palette[Number(teamNumber) % palette.length];
}

function normalizeLoadedTeam(team) {
  return {
    key: team.key,
    number: String(team.team_number),
    nickname: team.nickname || team.name || `Team ${team.team_number}`,
    location: [team.city, team.state_prov].filter(Boolean).join(", "),
    color: assignTeamColor(team.team_number),
  };
}

function teamLookupByKey(teamKey) {
  return state.tba.teams.find((team) => team.key === teamKey);
}

function formatMatchLabel(match) {
  const levelMap = {
    qm: "Qual",
    ef: "Eighth",
    qf: "QF",
    sf: "SF",
    f: "Final",
  };
  const prefix = levelMap[match.compLevel] || match.compLevel.toUpperCase();
  if (match.compLevel === "qm") {
    return `${prefix} ${match.matchNumber}`;
  }
  return `${prefix} ${match.setNumber}-${match.matchNumber}`;
}

function normalizeMatch(match) {
  return {
    key: match.key,
    compLevel: match.comp_level,
    setNumber: match.set_number,
    matchNumber: match.match_number,
    redTeamKeys: [...(match.alliances?.red?.team_keys || [])],
    blueTeamKeys: [...(match.alliances?.blue?.team_keys || [])],
  };
}

function filterLoadedTeams(query = els.tbaTeamSearch.value.trim().toLowerCase()) {
  if (!query) {
    state.tba.filteredTeams = [...state.tba.teams];
    return;
  }

  state.tba.filteredTeams = state.tba.teams.filter((team) => {
    return team.number.includes(query) || team.nickname.toLowerCase().includes(query);
  });
}

function renderTbaTeams() {
  els.tbaTeamCount.textContent = `${state.tba.teams.length} teams`;
  els.tbaTeamList.innerHTML = "";

  if (state.tba.isLoading) {
    const loading = document.createElement("div");
    loading.className = "team-directory-loading";
    loading.textContent = "Loading teams from The Blue Alliance...";
    els.tbaTeamList.appendChild(loading);
    return;
  }

  if (!state.tba.filteredTeams.length) {
    const empty = document.createElement("div");
    empty.className = "team-directory-empty";
    empty.textContent = state.tba.teams.length
      ? "No teams match that search."
      : "No teams loaded yet.";
    els.tbaTeamList.appendChild(empty);
    return;
  }

  state.tba.filteredTeams.forEach((team) => {
    const item = document.createElement("div");
    item.className = "team-directory-item";

    const swatch = document.createElement("span");
    swatch.className = "team-swatch";
    swatch.style.background = team.color;

    const copy = document.createElement("div");
    copy.className = "team-directory-copy";

    const title = document.createElement("strong");
    title.className = "team-directory-title";
    title.textContent = `${team.number} • ${team.nickname}`;

    const meta = document.createElement("span");
    meta.className = "team-directory-meta";
    meta.textContent = team.location || "Location unavailable";

    copy.appendChild(title);
    copy.appendChild(meta);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button team-directory-action";
    button.textContent = "Add";
    button.addEventListener("click", () => addTeamMarker(team));

    item.appendChild(swatch);
    item.appendChild(copy);
    item.appendChild(button);
    els.tbaTeamList.appendChild(item);
  });
}

function renderTbaMatches() {
  els.tbaMatchCount.textContent = `${state.tba.matches.length} matches`;
  els.tbaMatchList.innerHTML = "";

  if (state.tba.isLoading) {
    const loading = document.createElement("div");
    loading.className = "match-directory-empty";
    loading.textContent = "Loading matches...";
    els.tbaMatchList.appendChild(loading);
    return;
  }

  if (!state.tba.matches.length) {
    const empty = document.createElement("div");
    empty.className = "match-directory-empty";
    empty.textContent = "No matches loaded yet.";
    els.tbaMatchList.appendChild(empty);
    return;
  }

  state.tba.matches.forEach((match) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-chip";
    button.addEventListener("click", () => placeMatchOnField(match));

    const title = document.createElement("span");
    title.className = "match-chip-title";
    title.textContent = formatMatchLabel(match);

    const meta = document.createElement("span");
    meta.className = "match-chip-meta";
    meta.textContent = `${match.redTeamKeys.length}R / ${match.blueTeamKeys.length}B`;

    button.appendChild(title);
    button.appendChild(meta);
    els.tbaMatchList.appendChild(button);
  });
}

function cloneBoard(board = { markers: state.markers, strokes: state.strokes }) {
  return {
    markers: board.markers.map((marker) => ({ ...marker })),
    strokes: board.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
  };
}

function resizeCanvas() {
  const rect = els.field.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = rect.width * ratio;
  els.canvas.height = rect.height * ratio;
  els.canvas.style.width = `${rect.width}px`;
  els.canvas.style.height = `${rect.height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  renderCanvas(state.strokes);
  renderMarkers(state.markers);
}

function renderCanvas(strokes, options = {}) {
  const width = els.canvas.width / (window.devicePixelRatio || 1);
  const height = els.canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, width, height);

  strokes.forEach((stroke) => {
    drawStroke(stroke, options.progressByStroke?.[stroke.id] ?? 1);
  });
}

function drawStroke(stroke, progress = 1) {
  if (!stroke.points.length) {
    return;
  }

  const points = getVisiblePoints(stroke.points, progress);
  if (stroke.tool === "eraser") {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = stroke.width;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
    } else {
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }

    ctx.stroke();
    ctx.restore();
    return;
  }

  const outlineWidth = stroke.width + 5;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = stroke.outlineColor || outlineColorForAlliance(stroke.alliance);
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
  } else {
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }

  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = stroke.width;
  ctx.strokeStyle = stroke.color;
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
  } else {
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }

  ctx.stroke();
  ctx.restore();
}

function getVisiblePoints(points, progress) {
  if (progress >= 1 || points.length < 2) {
    return points;
  }

  const targetIndex = Math.max(1, Math.floor((points.length - 1) * progress));
  const visible = points.slice(0, targetIndex + 1);
  const exactIndex = (points.length - 1) * progress;
  const baseIndex = Math.floor(exactIndex);
  const nextIndex = Math.min(points.length - 1, baseIndex + 1);

  if (nextIndex > baseIndex) {
    const blend = exactIndex - baseIndex;
    visible[visible.length - 1] = {
      x: points[baseIndex].x + (points[nextIndex].x - points[baseIndex].x) * blend,
      y: points[baseIndex].y + (points[nextIndex].y - points[baseIndex].y) * blend,
    };
  }

  return visible;
}

function renderMarkers(markers) {
  els.markerLayer.innerHTML = "";

  markers.forEach((marker) => {
    const markerEl = document.createElement("button");
    markerEl.type = "button";
    markerEl.className = "marker";
    markerEl.dataset.markerId = marker.id;
    markerEl.style.background = marker.color;
    markerEl.style.borderColor = outlineColorForAlliance(inferAllianceForMarker(marker));
    markerEl.style.left = `${marker.x * 100}%`;
    markerEl.style.top = `${marker.y * 100}%`;
    markerEl.style.transform = "translate(-50%, -50%)";
    markerEl.setAttribute("aria-label", `Team ${marker.number}`);

    if (marker.id === state.selectedMarkerId) {
      markerEl.classList.add("is-selected");
    }

    if (marker.logoDataUrl) {
      const image = document.createElement("img");
      image.src = marker.logoDataUrl;
      image.alt = "";
      image.className = "marker-logo";
      markerEl.appendChild(image);

      const overlay = document.createElement("div");
      overlay.className = "marker-overlay";
      overlay.textContent = marker.number;
      markerEl.appendChild(overlay);
    } else {
      markerEl.textContent = marker.number;
    }

    if (marker.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "marker-label";
      labelEl.textContent = marker.label;
      markerEl.appendChild(labelEl);
    }

    markerEl.addEventListener("pointerdown", startMarkerDrag);
    els.markerLayer.appendChild(markerEl);
  });
}

function setTool(nextTool) {
  state.tool = nextTool;
  els.toolPen.classList.toggle("is-active", nextTool === "pen");
  els.toolEraser.classList.toggle("is-active", nextTool === "eraser");
}

function setDrawAlliance(alliance) {
  state.drawAlliance = alliance;
  els.drawRed.classList.toggle("is-active", alliance === "red");
  els.drawBlue.classList.toggle("is-active", alliance === "blue");
}

function pointerToField(event) {
  const rect = els.field.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    nx: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    ny: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
  };
}

function inferAllianceForMarker(marker) {
  if (marker.alliance) {
    return marker.alliance;
  }
  return marker.x <= 0.5 ? "red" : "blue";
}

function syncDrawSettingsFromMarker(marker) {
  const alliance = inferAllianceForMarker(marker);
  setDrawAlliance(alliance);
  state.strokeColor = marker.color;
  els.strokeColor.value = marker.color;
}

function startStroke(event) {
  if (state.playback.isPlaying || event.target.closest(".marker")) {
    return;
  }

  event.preventDefault();
  const point = pointerToField(event);
  state.activeStroke = {
    id: uid("stroke"),
    tool: state.tool,
    color: state.strokeColor,
    alliance: state.drawAlliance,
    outlineColor: outlineColorForAlliance(state.drawAlliance),
    width: Number(state.strokeWidth),
    points: [{ x: point.x, y: point.y }],
  };

  state.pointerMap.set(event.pointerId, "drawing");
  els.field.setPointerCapture(event.pointerId);
}

function continueStroke(event) {
  if (state.pointerMap.get(event.pointerId) !== "drawing" || !state.activeStroke) {
    return;
  }

  const point = pointerToField(event);
  state.activeStroke.points.push({ x: point.x, y: point.y });
  renderCanvas([...state.strokes, state.activeStroke]);
}

function finishStroke(event) {
  if (state.pointerMap.get(event.pointerId) !== "drawing" || !state.activeStroke) {
    return;
  }

  if (state.activeStroke.points.length === 1) {
    const point = state.activeStroke.points[0];
    state.activeStroke.points.push({ x: point.x + 0.01, y: point.y + 0.01 });
  }

  state.strokes.push(state.activeStroke);
  state.activeStroke = null;
  state.pointerMap.delete(event.pointerId);
  renderCanvas(state.strokes);
}

function startMarkerDrag(event) {
  if (state.playback.isPlaying) {
    return;
  }

  event.preventDefault();
  const markerId = event.currentTarget.dataset.markerId;
  state.selectedMarkerId = markerId;
  const marker = state.markers.find((item) => item.id === markerId);

  if (!marker) {
    return;
  }

  syncDrawSettingsFromMarker(marker);
  state.activeMarkerDrag = markerId;
  state.pointerMap.set(event.pointerId, "marker");
  event.currentTarget.setPointerCapture(event.pointerId);
  renderMarkers(state.markers);
}

function continueMarkerDrag(event) {
  if (state.pointerMap.get(event.pointerId) !== "marker" || !state.activeMarkerDrag) {
    return;
  }

  const point = pointerToField(event);
  const marker = state.markers.find((item) => item.id === state.activeMarkerDrag);

  if (!marker) {
    return;
  }

  marker.x = point.nx;
  marker.y = point.ny;
  renderMarkers(state.markers);
}

function finishMarkerDrag(event) {
  if (state.pointerMap.get(event.pointerId) !== "marker") {
    return;
  }

  state.activeMarkerDrag = null;
  state.pointerMap.delete(event.pointerId);
}

function removeSelectedMarker() {
  if (!state.selectedMarkerId) {
    return;
  }

  state.markers = state.markers.filter((marker) => marker.id !== state.selectedMarkerId);
  state.selectedMarkerId = null;
  renderMarkers(state.markers);
}

function addMarkerFromConfig(config, options = {}) {
  const existingMarker = state.markers.find((marker) => marker.number === config.number);
  if (existingMarker && !options.allowDuplicate) {
    state.selectedMarkerId = existingMarker.id;
    renderMarkers(state.markers);
    return false;
  }

  const marker = {
    id: uid("marker"),
    number: config.number,
    label: config.label || "",
    color: config.color,
    alliance: config.alliance || null,
    x: 0.5 + (Math.random() * 0.16 - 0.08),
    y: 0.5 + (Math.random() * 0.16 - 0.08),
    logoDataUrl: config.logoDataUrl || "",
  };

  state.markers.push(marker);
  state.selectedMarkerId = marker.id;
  renderMarkers(state.markers);
  return true;
}

function addTeamMarker(team) {
  const added = addMarkerFromConfig({
    number: team.number,
    label: team.nickname,
    color: team.color,
    alliance: state.drawAlliance,
  });

  setTbaStatus(
    added ? `Added Team ${team.number} to the board.` : `Team ${team.number} is already on the board.`
  );
}

function buildMatchMarkers(match) {
  const redMarkers = match.redTeamKeys.map((teamKey, index) => {
    const team = teamLookupByKey(teamKey);
    const slot = MATCH_START_POSITIONS.red[index] || MATCH_START_POSITIONS.red[0];
    return {
      id: uid("marker"),
      number: team ? team.number : teamKey.replace("frc", ""),
      label: team ? team.nickname : teamKey,
      color: team ? team.color : "#ef4444",
      alliance: "red",
      x: slot.x,
      y: slot.y,
      logoDataUrl: "",
    };
  });

  const blueMarkers = match.blueTeamKeys.map((teamKey, index) => {
    const team = teamLookupByKey(teamKey);
    const slot = MATCH_START_POSITIONS.blue[index] || MATCH_START_POSITIONS.blue[0];
    return {
      id: uid("marker"),
      number: team ? team.number : teamKey.replace("frc", ""),
      label: team ? team.nickname : teamKey,
      color: team ? team.color : "#3b82f6",
      alliance: "blue",
      x: slot.x,
      y: slot.y,
      logoDataUrl: "",
    };
  });

  return [...redMarkers, ...blueMarkers];
}

function placeMatchOnField(match) {
  stopPlayback(true);
  state.markers = buildMatchMarkers(match);
  state.selectedMarkerId = state.markers[0]?.id || null;
  if (state.markers[0]) {
    syncDrawSettingsFromMarker(state.markers[0]);
  }
  renderMarkers(state.markers);
  setTbaStatus(`Placed ${formatMatchLabel(match)} onto the field.`);
}

async function loadTbaTeams() {
  const eventKey = els.tbaEventKey.value.trim().toLowerCase();

  state.tba.eventKey = eventKey || "2026caasv";
  els.tbaEventKey.value = state.tba.eventKey;
  saveTbaSettings();

  state.tba.isLoading = true;
  renderTbaTeams();
  renderTbaMatches();
  setTbaStatus(`Loading teams for ${state.tba.eventKey}...`);

  try {
    const response = await fetch(
      `/.netlify/functions/tba?eventKey=${encodeURIComponent(state.tba.eventKey)}`
    );

    if (!response.ok) {
      let message = `TBA proxy failed (${response.status}).`;
      if (response.status === 404) {
        message = `No TBA event was found for ${state.tba.eventKey}.`;
      } else if (response.status === 500) {
        message = "Netlify could not reach TBA. Make sure TBA_API_KEY is set in Netlify.";
      }
      throw new Error(message);
    }

    const payload = await response.json();
    const teams = payload.teams || [];
    const matches = payload.matches || [];
    state.tba.teams = teams
      .map(normalizeLoadedTeam)
      .sort((left, right) => Number(left.number) - Number(right.number));
    state.tba.matches = matches
      .map(normalizeMatch)
      .sort((left, right) => {
        const compOrder = ["qm", "ef", "qf", "sf", "f"];
        const leftIndex = compOrder.indexOf(left.compLevel);
        const rightIndex = compOrder.indexOf(right.compLevel);
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        if (left.setNumber !== right.setNumber) {
          return left.setNumber - right.setNumber;
        }
        return left.matchNumber - right.matchNumber;
      });
    filterLoadedTeams("");
    renderTbaTeams();
    renderTbaMatches();
    setTbaStatus(
      `Loaded ${state.tba.teams.length} teams and ${state.tba.matches.length} matches for ${state.tba.eventKey}.`
    );
  } catch (error) {
    state.tba.teams = [];
    state.tba.matches = [];
    filterLoadedTeams("");
    renderTbaTeams();
    renderTbaMatches();
    setTbaStatus(error.message || "Could not load teams from TBA.", true);
  } finally {
    state.tba.isLoading = false;
    renderTbaTeams();
    renderTbaMatches();
  }
}

function clearDrawing() {
  state.strokes = [];
  renderCanvas(state.strokes);
}

function resetBoard() {
  stopPlayback(true);
  state.strokes = [];
  state.markers = [];
  state.steps = [];
  state.selectedMarkerId = null;
  renderCanvas(state.strokes);
  renderMarkers(state.markers);
  renderTimeline();
}

function addStep() {
  const snapshot = cloneBoard();
  const duration = Number(els.stepDuration.value) * 1000;
  const name = els.stepName.value.trim() || `Step ${state.steps.length + 1}`;

  state.steps.push({
    id: uid("step"),
    name,
    duration,
    snapshot,
  });

  els.stepName.value = "";
  renderTimeline();
}

function renderTimeline() {
  els.timelineList.innerHTML = "";

  state.steps.forEach((step, index) => {
    const item = els.timelineTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".timeline-title").textContent = `${index + 1}. ${step.name}`;
    item.querySelector(".timeline-meta").textContent = `${Math.round(step.duration / 1000)}s • ${step.snapshot.markers.length} markers • ${step.snapshot.strokes.length} strokes`;

    item.querySelector(".timeline-load").addEventListener("click", () => loadSnapshot(step.snapshot));
    item.querySelector(".timeline-delete").addEventListener("click", () => {
      state.steps = state.steps.filter((entry) => entry.id !== step.id);
      renderTimeline();
    });

    els.timelineList.appendChild(item);
  });
}

function loadSnapshot(snapshot, options = {}) {
  if (options.stopPlayback !== false) {
    stopPlayback(true);
  }

  const cloned = cloneBoard(snapshot);
  state.markers = cloned.markers;
  state.strokes = cloned.strokes;
  renderCanvas(state.strokes);
  renderMarkers(state.markers);
}

function setStatus(text, playing = false) {
  els.statusPill.textContent = text;
  els.statusPill.style.color = playing ? "#9a3412" : "#0f766e";
  els.statusPill.style.background = playing ? "rgba(234, 88, 12, 0.12)" : "rgba(15, 118, 110, 0.12)";
}

function interpolateMarkers(fromMarkers, toMarkers, progress) {
  const fromById = new Map(fromMarkers.map((marker) => [marker.id, marker]));
  return toMarkers.map((marker) => {
    const previous = fromById.get(marker.id);
    if (!previous) {
      return { ...marker };
    }

    return {
      ...marker,
      x: previous.x + (marker.x - previous.x) * progress,
      y: previous.y + (marker.y - previous.y) * progress,
    };
  });
}

function getPlaybackFrame(fromSnapshot, toSnapshot, progress) {
  const previousStrokes = cloneBoard(fromSnapshot).strokes;
  const previousIds = new Set(previousStrokes.map((stroke) => stroke.id));
  const addedStrokes = toSnapshot.strokes.filter((stroke) => !previousIds.has(stroke.id));
  const progressByStroke = {};

  if (addedStrokes.length) {
    const scaled = progress * addedStrokes.length;
    addedStrokes.forEach((stroke, index) => {
      progressByStroke[stroke.id] = Math.min(Math.max(scaled - index, 0), 1);
    });
  }

  return {
    markers: interpolateMarkers(fromSnapshot.markers, toSnapshot.markers, progress),
    strokes: [...previousStrokes, ...addedStrokes],
    progressByStroke,
  };
}

async function playSequence() {
  if (!state.steps.length || state.playback.isPlaying) {
    return;
  }

  state.playback.isPlaying = true;
  state.playback.stopRequested = false;
  state.playback.lastRendered = { markers: [], strokes: [] };
  setStatus("Playing timeline", true);

  let previous = { markers: [], strokes: [] };

  for (const step of state.steps) {
    if (state.playback.stopRequested) {
      break;
    }

    await animateStep(previous, step.snapshot, step.duration, step.name);
    previous = cloneBoard(step.snapshot);
  }

  state.playback.isPlaying = false;
  state.playback.frame = 0;

  if (!state.playback.stopRequested && state.steps.length) {
    loadSnapshot(state.steps[state.steps.length - 1].snapshot, { stopPlayback: false });
  } else if (state.playback.stopRequested) {
    const frozenBoard = cloneBoard(state.playback.lastRendered);
    state.markers = frozenBoard.markers;
    state.strokes = frozenBoard.strokes;
    renderCanvas(state.strokes);
    renderMarkers(state.markers);
  }

  state.playback.stopRequested = false;
  setStatus("Editing");
}

function animateStep(fromSnapshot, toSnapshot, duration, name) {
  return new Promise((resolve) => {
    state.playback.resolveCurrentStep = resolve;
    const start = performance.now();
    setStatus(`Playing: ${name}`, true);

    function frame(now) {
      if (state.playback.stopRequested) {
        state.playback.resolveCurrentStep = null;
        resolve();
        return;
      }

      const progress = Math.min((now - start) / duration, 1);
      const playbackFrame = getPlaybackFrame(fromSnapshot, toSnapshot, easeInOut(progress));
      state.playback.lastRendered = cloneBoard(playbackFrame);
      renderCanvas(playbackFrame.strokes, { progressByStroke: playbackFrame.progressByStroke });
      renderMarkers(playbackFrame.markers);

      if (progress < 1) {
        state.playback.frame = requestAnimationFrame(frame);
      } else {
        renderCanvas(toSnapshot.strokes);
        renderMarkers(toSnapshot.markers);
        state.playback.lastRendered = cloneBoard(toSnapshot);
        state.playback.resolveCurrentStep = null;
        resolve();
      }
    }

    state.playback.frame = requestAnimationFrame(frame);
  });
}

function stopPlayback(resetStatus = false) {
  state.playback.stopRequested = true;
  state.playback.isPlaying = false;
  cancelAnimationFrame(state.playback.frame);
  if (state.playback.resolveCurrentStep) {
    const resolve = state.playback.resolveCurrentStep;
    state.playback.resolveCurrentStep = null;
    resolve();
  }
  if (resetStatus) {
    setStatus("Editing");
  }
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);

  els.tbaEventKey.addEventListener("change", (event) => {
    state.tba.eventKey = event.target.value.trim().toLowerCase() || "2026caasv";
    event.target.value = state.tba.eventKey;
    saveTbaSettings();
  });
  els.loadTbaTeams.addEventListener("click", loadTbaTeams);
  els.refreshTbaTeams.addEventListener("click", loadTbaTeams);
  els.tbaTeamSearch.addEventListener("input", (event) => {
    filterLoadedTeams(event.target.value.trim().toLowerCase());
    renderTbaTeams();
  });
  els.removeMarker.addEventListener("click", removeSelectedMarker);
  els.clearDrawing.addEventListener("click", clearDrawing);
  els.resetBoard.addEventListener("click", resetBoard);
  els.toolPen.addEventListener("click", () => setTool("pen"));
  els.toolEraser.addEventListener("click", () => setTool("eraser"));
  els.drawRed.addEventListener("click", () => setDrawAlliance("red"));
  els.drawBlue.addEventListener("click", () => setDrawAlliance("blue"));
  els.strokeColor.addEventListener("input", (event) => {
    state.strokeColor = event.target.value;
  });
  els.randomizeStroke.addEventListener("click", () => {
    state.strokeColor = randomHexColor();
    els.strokeColor.value = state.strokeColor;
  });
  els.strokeWidth.addEventListener("input", (event) => {
    state.strokeWidth = event.target.value;
  });
  els.addStep.addEventListener("click", addStep);
  els.playSequence.addEventListener("click", playSequence);
  els.pauseSequence.addEventListener("click", () => stopPlayback(true));
  els.stepDuration.addEventListener("input", (event) => {
    els.stepDurationLabel.textContent = `${event.target.value}s`;
  });

  els.field.addEventListener("pointerdown", startStroke);
  window.addEventListener("pointermove", continueStroke);
  window.addEventListener("pointerup", finishStroke);
  window.addEventListener("pointercancel", finishStroke);
  window.addEventListener("pointermove", continueMarkerDrag);
  window.addEventListener("pointerup", finishMarkerDrag);
  window.addEventListener("pointercancel", finishMarkerDrag);

  document.addEventListener("keydown", (event) => {
    const tagName = document.activeElement?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA") {
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && state.selectedMarkerId) {
      removeSelectedMarker();
    }
  });
}

function init() {
  readStoredTbaSettings();
  filterLoadedTeams("");
  renderTbaTeams();
  renderTbaMatches();
  bindEvents();
  resizeCanvas();
  els.strokeColor.value = state.strokeColor;
  setDrawAlliance(state.drawAlliance);
  setStatus("Editing");
  loadTbaTeams();
}

init();
