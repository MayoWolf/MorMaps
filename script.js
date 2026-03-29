const state = {
  tool: "pen",
  strokeColor: "#1f2937",
  strokeWidth: 5,
  strokes: [],
  markers: [],
  steps: [],
  selectedMarkerId: null,
  activeStroke: null,
  activeMarkerDrag: null,
  pointerMap: new Map(),
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
  addMarker: document.getElementById("add-marker"),
  removeMarker: document.getElementById("remove-marker"),
  clearDrawing: document.getElementById("clear-drawing"),
  resetBoard: document.getElementById("reset-board"),
  toolPen: document.getElementById("tool-pen"),
  toolEraser: document.getElementById("tool-eraser"),
  strokeColor: document.getElementById("stroke-color"),
  strokeWidth: document.getElementById("stroke-width"),
  teamNumber: document.getElementById("team-number"),
  teamLabel: document.getElementById("team-label"),
  teamColor: document.getElementById("team-color"),
  teamLogo: document.getElementById("team-logo"),
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

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = stroke.width;
  ctx.strokeStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";

  const points = getVisiblePoints(stroke.points, progress);
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

function pointerToField(event) {
  const rect = els.field.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    nx: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    ny: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
  };
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

function addMarker() {
  const teamNumber = els.teamNumber.value.trim();
  if (!teamNumber) {
    els.teamNumber.focus();
    return;
  }

  const label = els.teamLabel.value.trim();
  const logoFile = els.teamLogo.files?.[0];
  const marker = {
    id: uid("marker"),
    number: teamNumber,
    label,
    color: els.teamColor.value,
    x: 0.5 + (Math.random() * 0.16 - 0.08),
    y: 0.5 + (Math.random() * 0.16 - 0.08),
    logoDataUrl: "",
  };

  const commitMarker = () => {
    state.markers.push(marker);
    state.selectedMarkerId = marker.id;
    renderMarkers(state.markers);
    els.teamNumber.value = "";
    els.teamLabel.value = "";
    els.teamLogo.value = "";
  };

  if (!logoFile) {
    commitMarker();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    marker.logoDataUrl = reader.result;
    commitMarker();
  };
  reader.readAsDataURL(logoFile);
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

  els.addMarker.addEventListener("click", addMarker);
  els.removeMarker.addEventListener("click", removeSelectedMarker);
  els.clearDrawing.addEventListener("click", clearDrawing);
  els.resetBoard.addEventListener("click", resetBoard);
  els.toolPen.addEventListener("click", () => setTool("pen"));
  els.toolEraser.addEventListener("click", () => setTool("eraser"));
  els.strokeColor.addEventListener("input", (event) => {
    state.strokeColor = event.target.value;
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
  bindEvents();
  resizeCanvas();
  setStatus("Editing");
}

init();
