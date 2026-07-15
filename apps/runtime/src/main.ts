import {
  READONLY_PROTOTYPE_ACTIONS,
  createReadonlyPrototypeController,
  type ReadonlyPrototypeState
} from "./readonly-prototype.js";

function assertRoot(value: Element | null): HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error("Expected #app root element.");
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getActionLabel(actionId: "look" | "inventory"): string {
  return actionId === "look" ? "Look" : "Inventory";
}

function renderListItems(items: readonly { readonly title: string; readonly description: string }[], empty: string): string {
  if (items.length === 0) {
    return `<div class="prototype-empty">${escapeHtml(empty)}</div>`;
  }

  return `
    <ul class="prototype-list">
      ${items.map((item) => `
        <li>
          <span class="prototype-list-title">${escapeHtml(item.title)}</span>
          <span class="prototype-list-copy">${escapeHtml(item.description)}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderLocation(state: ReadonlyPrototypeState): string {
  if (state.location === undefined) {
    return `<div class="prototype-empty">Location data is not available.</div>`;
  }

  return `
    <div class="prototype-card-row">
      <div class="prototype-meta-card">
        <span class="prototype-list-label">Current location</span>
        <strong>${escapeHtml(state.location.title)}</strong>
      </div>
      <p>${escapeHtml(state.location.description)}</p>
    </div>
  `;
}

function renderWorldDetails(state: ReadonlyPrototypeState): string {
  const location = state.location;
  if (location === undefined) {
    return `<div class="prototype-empty">World details are not available.</div>`;
  }

  const exitsMarkup = location.exits.length === 0
    ? `<div class="prototype-empty">No exits are exposed in this read-only snapshot.</div>`
    : `
      <ul class="prototype-list">
        ${location.exits.map((exit) => `
          <li>
            <span class="prototype-list-title">${escapeHtml(exit.label)}</span>
            <span class="prototype-code">${escapeHtml(exit.targetLocationId)}</span>
          </li>
        `).join("")}
      </ul>
    `;

  const npcsMarkup = location.npcs.length === 0
    ? `<div class="prototype-empty">No NPCs are visible.</div>`
    : `
      <ul class="prototype-list">
        ${location.npcs.map((npc) => `
          <li>
            <span class="prototype-list-title">${escapeHtml(npc.name)}</span>
            <span class="prototype-code">${escapeHtml(npc.npcId)}</span>
          </li>
        `).join("")}
      </ul>
    `;

  return `
    <div class="prototype-subpanel">
      <h3>Exits</h3>
      ${exitsMarkup}
    </div>
    <div class="prototype-subpanel">
      <h3>Items</h3>
      ${renderListItems(location.items, "No visible items.")}
    </div>
    <div class="prototype-subpanel">
      <h3>NPCs</h3>
      ${npcsMarkup}
    </div>
  `;
}

function renderInventory(state: ReadonlyPrototypeState): string {
  if (state.inventory === undefined) {
    return `<div class="prototype-empty">Inventory data is not available.</div>`;
  }

  return `
    <div class="prototype-chip-row">
      <div class="prototype-chip">
        <span class="prototype-list-label">Item count</span>
        <strong>${String(state.inventory.itemCount)}</strong>
      </div>
      <div class="prototype-chip">
        <span class="prototype-list-label">Read-only</span>
        <strong>${state.inventory.empty ? "Empty" : "Stable"}</strong>
      </div>
    </div>
    <div class="prototype-subpanel">
      ${renderListItems(state.inventory.items, "Inventory is empty.")}
    </div>
  `;
}

function renderTranscript(state: ReadonlyPrototypeState): string {
  return `
    <div class="prototype-subpanel">
      <h3>Transcript Preview</h3>
      <ul class="prototype-output-list">
        ${state.transcript.map((line) => `<li>${escapeHtml(line.text)}</li>`).join("")}
      </ul>
    </div>
    <div class="prototype-subpanel">
      <h3>${escapeHtml(state.output.title)}</h3>
      <ul class="prototype-output-list">
        ${state.output.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderDiagnostics(state: ReadonlyPrototypeState): string {
  if (state.diagnostics.length === 0) {
    return `<div class="prototype-empty">No diagnostics.</div>`;
  }

  return `
    <ul class="prototype-diagnostic-list">
      ${state.diagnostics.map((diagnostic) => `
        <li>
          <strong>${escapeHtml(diagnostic.code)}</strong>
          <div>${escapeHtml(diagnostic.message)}</div>
          <div class="prototype-code">${escapeHtml(diagnostic.phase)} · ${escapeHtml(diagnostic.category)} · ${escapeHtml(diagnostic.severity)}</div>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderApp(state: ReadonlyPrototypeState): string {
  return `
    <main class="prototype-shell">
      <section class="prototype-hero">
        <div class="prototype-hero-inner">
          <div>
            <div class="prototype-kicker">Read-only runtime prototype</div>
            <h1 class="prototype-title">${escapeHtml(state.screenTitle)}</h1>
            <p class="prototype-summary">${escapeHtml(state.screenSubtitle)}</p>
          </div>
          <div class="prototype-hero-grid">
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Scenario</span>
              <strong>${escapeHtml(state.scenarioId)}</strong>
            </div>
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Package</span>
              <strong>${escapeHtml(state.packageId)}</strong>
            </div>
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Actions</span>
              <strong>${state.availableActions.map((actionId) => escapeHtml(actionId)).join(" · ")}</strong>
            </div>
          </div>
          <div class="prototype-actions">
            ${READONLY_PROTOTYPE_ACTIONS.map((actionId) => `
              <button type="button" data-action="${escapeHtml(actionId)}">${getActionLabel(actionId)}</button>
            `).join("")}
          </div>
          <div class="prototype-status${state.status.kind === "executed" || state.status.kind === "idle" ? "" : " is-warning"}">
            ${escapeHtml(state.status.detail)}
          </div>
        </div>
      </section>
      <section class="prototype-grid">
        <article class="prototype-panel">
          <h2>Location</h2>
          ${renderLocation(state)}
        </article>
        <article class="prototype-panel">
          <h2>Exits, Items, and NPCs</h2>
          ${renderWorldDetails(state)}
        </article>
        <article class="prototype-panel">
          <h2>Inventory</h2>
          ${renderInventory(state)}
        </article>
        <article class="prototype-panel">
          <h2>Transcript and Output</h2>
          ${renderTranscript(state)}
        </article>
        <article class="prototype-panel">
          <h2>Diagnostics</h2>
          ${renderDiagnostics(state)}
        </article>
      </section>
      <div class="prototype-footer-note">
        The prototype stays in-memory, exposes only look and inventory, and routes both actions through the TASK-095 read-only interaction boundary.
      </div>
    </main>
  `;
}

const root = assertRoot(document.querySelector("#app"));
const controller = createReadonlyPrototypeController();

function render(): void {
  const state = controller.getState();
  root.innerHTML = renderApp(state);

  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((actionButton) => {
    actionButton.addEventListener("click", () => {
      const actionId = actionButton.getAttribute("data-action");
      if (actionId === "look" || actionId === "inventory") {
        controller.runAction(actionId);
        render();
      }
    });
  });
}

render();
