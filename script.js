
const API = "http://localhost:8080";

const capacitySelect = document.getElementById("capacity");
const bufferElement = document.getElementById("buffer");
const countElement = document.getElementById("count");
const producedElement = document.getElementById("produced");
const consumedElement = document.getElementById("consumed");
const logElement = document.getElementById("log");
const emptyCountElement = document.getElementById("emptyCount");
const fullCountElement = document.getElementById("fullCount");
const mutexStatusElement = document.getElementById("mutexStatus");

const produceButton = document.getElementById("produce");
const consumeButton = document.getElementById("consume");
const resetButton = document.getElementById("reset");
const startButton = document.getElementById("startAuto");
const stopButton = document.getElementById("stopAuto");

let capacity = 5;
let automaticMode = false;
let autoTimer = null;
let autoTurn = "produce";
let requestInProgress = false;

function log(message) {
  const line = document.createElement("p");
  line.textContent = message;
  logElement.prepend(line);
}

function showBackendLogs(messages) {
  logElement.replaceChildren();

  [...messages].reverse().forEach(message => {
    const line = document.createElement("p");
    line.textContent = message;
    logElement.appendChild(line);
  });
}

function render(state) {
  capacity = state.capacity;

  // This backend currently supports a fixed capacity of 5.
  if (capacitySelect) {
    capacitySelect.value = String(capacity);
    capacitySelect.disabled = true;
    capacitySelect.title = "The Java backend currently uses capacity 5.";
  }

  bufferElement.replaceChildren();

  for (let i = 0; i < capacity; i++) {
    const slot = document.createElement("div");
    slot.className = "slot" + (state.buffer[i] ? " filled" : "");

    const label = document.createElement("small");
    label.textContent = "Slot " + (i + 1);

    const value = document.createElement("strong");
    value.textContent = state.buffer[i] ?? "EMPTY";

    slot.append(label, value);
    bufferElement.appendChild(slot);
  }

  countElement.textContent = state.count;
  producedElement.textContent = state.produced;
  consumedElement.textContent = state.consumed;
  emptyCountElement.textContent = state.empty;
  fullCountElement.textContent = state.full;
  mutexStatusElement.textContent = state.mutex;

  showBackendLogs(state.log || []);
}

async function requestBackend(endpoint, method = "GET") {
  try {
    const response = await fetch(`${API}${endpoint}`, { method });
    const state = await response.json();

    // Display the latest backend state even for expected 409 errors.
    if (typeof state.capacity === "number") {
      render(state);
    }

    if (response.status === 409) {
      log(state.log?.at(-1) || "Operation rejected.");
      return false;
    }

    if (!response.ok) {
      throw new Error(state.error || `HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    log("Backend error: " + error.message);
    log("Check that the Java server is running on port 8080.");
    return false;
  }
}

async function performOperation(endpoint) {
  if (requestInProgress) return;

  requestInProgress = true;
  produceButton.disabled = true;
  consumeButton.disabled = true;

  try {
    await requestBackend(endpoint, "POST");
  } finally {
    requestInProgress = false;
    produceButton.disabled = false;
    consumeButton.disabled = false;
  }
}

produceButton.addEventListener("click", () => {
  performOperation("/produce");
});

consumeButton.addEventListener("click", () => {
  performOperation("/consume");
});

resetButton.addEventListener("click", async () => {
  stopAutomatic();
  await requestBackend("/reset", "POST");
});

function startAutomatic() {
  if (automaticMode) return;

  automaticMode = true;
  autoTurn = "produce";

  startButton.disabled = true;
  stopButton.disabled = false;

  log("Automatic simulation started.");
  runAutomatic();
}

async function runAutomatic() {
  if (!automaticMode) return;

  const endpoint = autoTurn === "produce" ? "/produce" : "/consume";

  // Change turns even if an operation is rejected because the
  // buffer is full or empty.
  autoTurn = autoTurn === "produce" ? "consume" : "produce";

  await requestBackend(endpoint, "POST");

  if (automaticMode) {
    autoTimer = setTimeout(runAutomatic, 1000);
  }
}

function stopAutomatic() {
  automaticMode = false;
  clearTimeout(autoTimer);
  autoTimer = null;

  startButton.disabled = false;
  stopButton.disabled = true;
}

startButton.addEventListener("click", startAutomatic);
stopButton.addEventListener("click", () => {
  stopAutomatic();
  log("Automatic simulation stopped.");
});

if (capacitySelect) {
  capacitySelect.disabled = true;
}

stopButton.disabled = true;

// Load the real state from Java when the page opens.
requestBackend("/state");
