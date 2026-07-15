import {
  PROTOTYPE_COMMAND_IDS,
  createReadonlyPrototypeController,
  type PrototypeCommandId,
  type PrototypeCommandPaletteItem,
  type PrototypeMapConnection,
  type PrototypeMapTile,
  type PrototypeScenarioId,
  type PrototypeScenarioOption,
  type ReadonlyPrototypeState
} from "./readonly-prototype.js";
import { isPrototypeScenarioId } from "./prototype-scenarios.js";

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

function renderScenarioSelectorItem(
  option: PrototypeScenarioOption,
  selectedScenarioId: PrototypeScenarioId
): string {
  const selected = option.scenarioId === selectedScenarioId;

  return `
    <button
      type="button"
      class="prototype-scenario-button${selected ? " is-selected" : ""}"
      data-scenario="${escapeHtml(option.scenarioId)}"
      aria-pressed="${selected ? "true" : "false"}"
    >
      <span class="prototype-command-header">
        <span class="prototype-command-label">${escapeHtml(option.label)}</span>
        <span class="prototype-command-state">${selected ? "Selected" : "Available"}</span>
      </span>
      <span class="prototype-palette-copy">${escapeHtml(option.description)}</span>
    </button>
  `;
}

function renderScenarioSelector(state: ReadonlyPrototypeState): string {
  return `
    <div class="prototype-selector-grid">
      ${state.scenarios.map((option) => renderScenarioSelectorItem(option, state.selectedScenarioId)).join("")}
    </div>
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

function renderCommandPaletteItem(item: PrototypeCommandPaletteItem): string {
  const reasonMarkup = item.enabled
    ? '<div class="prototype-palette-copy">Routes through the read-only interaction boundary.</div>'
    : `<div class="prototype-palette-copy">${escapeHtml(item.disabledReason ?? "Unavailable.")}</div>`;

  return `
    <button
      type="button"
      class="prototype-command-button${item.enabled ? " is-enabled" : " is-disabled"}"
      data-action="${escapeHtml(item.commandId)}"
      aria-disabled="${item.enabled ? "false" : "true"}"
    >
      <span class="prototype-command-header">
        <span class="prototype-command-label">${escapeHtml(item.label)}</span>
        <span class="prototype-command-state">${item.enabled ? "Ready" : "Disabled"}</span>
      </span>
      ${reasonMarkup}
    </button>
  `;
}

function renderCommandPalette(state: ReadonlyPrototypeState): string {
  return `
    <div class="prototype-command-grid">
      ${state.commandPalette.map((item) => renderCommandPaletteItem(item)).join("")}
    </div>
  `;
}

function renderMapTile(tile: PrototypeMapTile, currentLocationId?: string): string {
  const isCurrent = tile.locationId === currentLocationId;

  return `
    <div
      class="prototype-map-tile prototype-map-tile-${escapeHtml(tile.kind)}${isCurrent ? " is-current" : ""}"
      style="grid-column:${String(tile.x)};grid-row:${String(tile.y)}"
    >
      <span class="prototype-map-tile-kind">${escapeHtml(tile.kind)}</span>
      <strong>${escapeHtml(tile.label)}</strong>
      <span class="prototype-code">${escapeHtml(tile.locationId)}</span>
    </div>
  `;
}

function renderMapConnection(
  connection: PrototypeMapConnection,
  tiles: readonly PrototypeMapTile[]
): string {
  const fromTile = tiles.find((tile) => tile.locationId === connection.fromLocationId);
  const toTile = tiles.find((tile) => tile.locationId === connection.toLocationId);

  if (fromTile === undefined || toTile === undefined) {
    return "";
  }

  if (fromTile.y === toTile.y) {
    const startColumn = Math.min(fromTile.x, toTile.x) + 1;
    const span = Math.max(Math.abs(fromTile.x - toTile.x) - 1, 1);

    return `
      <div
        class="prototype-map-connection prototype-map-connection-horizontal"
        style="grid-column:${String(startColumn)} / span ${String(span)};grid-row:${String(fromTile.y)}"
        aria-hidden="true"
      >
        <span>${escapeHtml(connection.kind)}</span>
      </div>
    `;
  }

  const startRow = Math.min(fromTile.y, toTile.y) + 1;
  const span = Math.max(Math.abs(fromTile.y - toTile.y) - 1, 1);

  return `
    <div
      class="prototype-map-connection prototype-map-connection-vertical"
      style="grid-column:${String(fromTile.x)};grid-row:${String(startRow)} / span ${String(span)}"
      aria-hidden="true"
    >
      <span>${escapeHtml(connection.kind)}</span>
    </div>
  `;
}

function renderMapPanel(state: ReadonlyPrototypeState): string {
  const { mapPanel } = state;
  const columns = Math.max(...mapPanel.tiles.map((tile) => tile.x));
  const rows = Math.max(...mapPanel.tiles.map((tile) => tile.y));
  const currentTile = mapPanel.tiles.find((tile) => tile.locationId === mapPanel.currentLocationId);

  return `
    <div class="prototype-map-frame">
      <div class="prototype-map-grid" style="grid-template-columns:repeat(${String(columns)}, minmax(0, 1fr));grid-template-rows:repeat(${String(rows)}, minmax(7rem, auto));">
        ${mapPanel.connections.map((connection) => renderMapConnection(connection, mapPanel.tiles)).join("")}
        ${mapPanel.tiles.map((tile) => renderMapTile(tile, mapPanel.currentLocationId)).join("")}
      </div>
      <div class="prototype-subpanel">
        <h3>Legend</h3>
        <div class="prototype-map-legend">
          ${mapPanel.legend.map((entry) => `<span class="prototype-map-legend-item">${escapeHtml(entry)}</span>`).join("")}
        </div>
      </div>
      <div class="prototype-subpanel">
        <h3>Map Status</h3>
        <div class="prototype-empty">
          ${currentTile === undefined
            ? "No current location is highlighted."
            : `${escapeHtml(currentTile.label)} remains highlighted until movement exists.`}
        </div>
      </div>
    </div>
  `;
}

function renderApp(state: ReadonlyPrototypeState): string {
  const selectedScenario = state.scenarios.find((scenario) => scenario.scenarioId === state.selectedScenarioId);

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
              <strong>${escapeHtml(selectedScenario?.label ?? state.selectedScenarioId)}</strong>
            </div>
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Scenario id</span>
              <strong>${escapeHtml(state.selectedScenarioId)}</strong>
            </div>
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Package</span>
              <strong>${escapeHtml(state.packageId)}</strong>
            </div>
            <div class="prototype-meta-card">
              <span class="prototype-list-label">Enabled now</span>
              <strong>${state.availableActions.map((actionId) => escapeHtml(actionId)).join(" · ")}</strong>
            </div>
          </div>
          <div class="prototype-status${state.status.kind === "executed" || state.status.kind === "idle" ? "" : " is-warning"}">
            ${escapeHtml(state.status.detail)}
          </div>
        </div>
      </section>
      <section class="prototype-grid">
        <article class="prototype-panel prototype-panel-wide">
          <h2>Scenario Selector</h2>
          <p class="prototype-summary">Scenario packages remain app-layer prototype data. Selecting a scenario rebuilds content, map, inventory, and transcript state without changing engine contracts.</p>
          ${renderScenarioSelector(state)}
        </article>
        <article class="prototype-panel prototype-panel-wide">
          <h2>Command Palette</h2>
          <p class="prototype-summary">The palette shows what is safe to execute now and what the future game UI will expose once mutable gameplay systems arrive.</p>
          ${renderCommandPalette(state)}
        </article>
        <article class="prototype-panel prototype-panel-wide">
          <h2>Map Layout</h2>
          <p class="prototype-summary">This panel is a UI-only spatial preview for the selected prototype scenario. It highlights the current room and known connection without adding movement or map data to engine contracts.</p>
          ${renderMapPanel(state)}
        </article>
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
        The prototype stays in-memory, switches between app-layer scenario packages, executes only look and inventory through the TASK-095 boundary, and surfaces future gameplay commands as disabled local UI affordances only.
      </div>
    </main>
  `;
}

function parseActionId(value: string | null): PrototypeCommandId | undefined {
  return value !== null && PROTOTYPE_COMMAND_IDS.includes(value as PrototypeCommandId)
    ? value as PrototypeCommandId
    : undefined;
}

function parseScenarioId(value: string | null): PrototypeScenarioId | undefined {
  return value !== null && isPrototypeScenarioId(value)
    ? value
    : undefined;
}

const root = assertRoot(document.querySelector("#app"));
const controller = createReadonlyPrototypeController();

function render(): void {
  const state = controller.getState();
  root.innerHTML = renderApp(state);

  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((actionButton) => {
    actionButton.addEventListener("click", () => {
      const actionId = parseActionId(actionButton.getAttribute("data-action"));
      if (actionId !== undefined) {
        controller.runAction(actionId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-scenario]").forEach((scenarioButton) => {
    scenarioButton.addEventListener("click", () => {
      const scenarioId = parseScenarioId(scenarioButton.getAttribute("data-scenario"));
      if (scenarioId !== undefined) {
        controller.selectScenario(scenarioId);
        render();
      }
    });
  });
}

render();
