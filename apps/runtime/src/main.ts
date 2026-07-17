import {
  PROTOTYPE_COMMAND_IDS,
  createReadonlyPrototypeController,
  type PrototypeCommandId,
  type PrototypeCommandPaletteItem,
  type PrototypeExitAction,
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
      <button type="button" class="prototype-inspect-button" data-inspect-location="true">Inspect Current Location</button>
    </div>
  `;
}

function renderExitAction(exitAction: PrototypeExitAction): string {
  const stateLabel = exitAction.availability === "available"
    ? "Move"
    : exitAction.availability === "locked"
      ? "Locked"
      : "Condition";
  const availabilityCopy = exitAction.disabledReason ?? "Movement is available through the controlled go boundary.";

  return `
    <div class="prototype-exit-card prototype-exit-button-${escapeHtml(exitAction.availability)}${exitAction.enabled ? "" : " is-blocked"}">
      <div class="prototype-command-header">
        <span class="prototype-command-label">${escapeHtml(exitAction.label)}</span>
        <span class="prototype-command-state">${escapeHtml(stateLabel)}</span>
      </div>
      <span class="prototype-palette-copy">Target: ${escapeHtml(exitAction.targetLocationTitle)} (${escapeHtml(exitAction.targetLocationId)})</span>
      <span class="prototype-palette-copy">${escapeHtml(availabilityCopy)}</span>
      <div class="prototype-inline-actions">
        <button type="button" class="prototype-exit-button" data-exit="${escapeHtml(exitAction.exitId)}">Move</button>
        <button type="button" class="prototype-inspect-button" data-inspect-exit="${escapeHtml(exitAction.exitId)}">Inspect</button>
      </div>
    </div>
  `;
}

function renderWorldDetails(state: ReadonlyPrototypeState): string {
  const location = state.location;
  if (location === undefined) {
    return `<div class="prototype-empty">World details are not available.</div>`;
  }

  const exitsMarkup = location.exits.length === 0
    ? `<div class="prototype-empty">No exits are available from this location.</div>`
    : `
      <div class="prototype-exit-grid">
        ${state.exitActions.map((exitAction) => renderExitAction(exitAction)).join("")}
      </div>
    `;

  const visibleItems = state.itemPresence.filter((item) => item.status === "visible-here");
  const itemsMarkup = visibleItems.length === 0
    ? `<div class="prototype-empty">No visible items.</div>`
    : `
      <ul class="prototype-list">
        ${visibleItems.map((item) => `
          <li>
            <span class="prototype-list-title">${escapeHtml(item.title)}</span>
            <span class="prototype-list-copy">${escapeHtml(item.description)}</span>
            <div class="prototype-code prototype-presence-label">Presence: ${escapeHtml(item.status)}</div>
            <div class="prototype-code prototype-presence-label">Portable: ${item.portable ? "yes" : "no"}</div>
            <div class="prototype-inline-actions">
              <button type="button" class="prototype-inspect-button" data-inspect-item="${escapeHtml(item.itemId)}">Inspect</button>
              ${item.takeEnabled
                ? `<button type="button" class="prototype-take-button" data-take-item="${escapeHtml(item.itemId)}">Take</button>`
                : `<button type="button" class="prototype-take-button is-disabled" disabled>Take</button>`}
            </div>
            ${item.takeEnabled ? "" : `<div class="prototype-palette-copy">${escapeHtml(item.takeDisabledReason ?? "Take is not available for this item.")}</div>`}
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
            <div class="prototype-inline-actions">
              <button type="button" class="prototype-inspect-button" data-inspect-npc="${escapeHtml(npc.npcId)}">Inspect</button>
            </div>
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
      ${itemsMarkup}
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

  const inventoryItems = state.itemPresence.filter((item) => item.status === "in-inventory");
  const itemsMarkup = inventoryItems.length === 0
    ? `<div class="prototype-empty">Inventory is empty.</div>`
    : `
      <ul class="prototype-list">
        ${inventoryItems.map((item) => `
          <li>
            <span class="prototype-list-title">${escapeHtml(item.title)}</span>
            <span class="prototype-list-copy">${escapeHtml(item.description)}</span>
            <div class="prototype-code prototype-presence-label">Presence: ${escapeHtml(item.status)}</div>
            <div class="prototype-inline-actions">
              <button type="button" class="prototype-inspect-button" data-inspect-item="${escapeHtml(item.itemId)}">Inspect</button>
            </div>
          </li>
        `).join("")}
      </ul>
    `;

  return `
    <div class="prototype-chip-row">
      <div class="prototype-chip">
        <span class="prototype-list-label">Item count</span>
        <strong>${String(inventoryItems.length)}</strong>
      </div>
      <div class="prototype-chip">
        <span class="prototype-list-label">Runtime state</span>
        <strong>${inventoryItems.length === 0 ? "Empty" : "Stable"}</strong>
      </div>
    </div>
    <div class="prototype-subpanel">
      ${itemsMarkup}
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
  const paletteCopy = item.commandId === "go" && item.enabled
    ? "Select a visible exit below. Available exits move now; locked or condition-gated exits report diagnostics without changing state."
    : item.enabled
      ? "Routes through an accepted runtime boundary."
      : item.disabledReason ?? "Unavailable.";

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
      <span class="prototype-palette-copy">${escapeHtml(paletteCopy)}</span>
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

function renderInspectionReadiness(state: ReadonlyPrototypeState): string {
  if (state.inspectionPanel.futureActionReadiness.length === 0) {
    return `<div class="prototype-empty">No future action readiness metadata is available until an inspectable entity is selected.</div>`;
  }

  return `
    <div class="prototype-readiness-list" aria-label="Future action readiness">
      ${state.inspectionPanel.futureActionReadiness.map((row) => `
        <div class="prototype-readiness-row prototype-readiness-${escapeHtml(row.status)}">
          <div class="prototype-command-header">
            <span class="prototype-command-label">${escapeHtml(row.label)}</span>
            <span class="prototype-command-state">${escapeHtml(row.status)}</span>
          </div>
          <div class="prototype-code">${escapeHtml(row.entityKind)} · ${escapeHtml(row.entityId)} · readonly</div>
          <div class="prototype-palette-copy">${escapeHtml(row.reason)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderInspectionPanel(state: ReadonlyPrototypeState): string {
  return `
    <div class="prototype-subpanel">
      <h3>${escapeHtml(state.inspectionPanel.title)}</h3>
      <ul class="prototype-output-list">
        ${state.inspectionPanel.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <div class="prototype-chip-row">
        <div class="prototype-chip">
          <span class="prototype-list-label">Readonly</span>
          <strong>true</strong>
        </div>
        <div class="prototype-chip">
          <span class="prototype-list-label">Future actions</span>
          <strong>${state.inspectionPanel.availableFutureActions.length === 0 ? "none" : state.inspectionPanel.availableFutureActions.map((actionId) => escapeHtml(actionId)).join(" · ")}</strong>
        </div>
      </div>
      <div class="prototype-subpanel">
        <h3>Future Action Readiness</h3>
        <p class="prototype-summary">These readiness rows are UI-only metadata for inspected entities. They do not execute planning, runtime commands, or movement.</p>
        ${renderInspectionReadiness(state)}
      </div>
      <div class="prototype-inline-actions">
        <button type="button" class="prototype-inspect-button" data-clear-inspection="true">Clear Inspection</button>
      </div>
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
            : `${escapeHtml(currentTile.label)} is the current highlighted room.`}
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
            <div class="prototype-kicker">Controlled runtime prototype</div>
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
          <p class="prototype-summary">The palette shows what is safe to execute now. Go is enabled only when the current location exposes concrete exits. Generic Take stays disabled here, while explicit visible portable item buttons run the dedicated pickup boundary.</p>
          ${renderCommandPalette(state)}
        </article>
        <article class="prototype-panel prototype-panel-wide">
          <h2>Map Layout</h2>
          <p class="prototype-summary">This panel remains UI-only. Controlled movement updates only the current highlighted room and does not add map schema to engine contracts.</p>
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
          <h2>Inspection</h2>
          ${renderInspectionPanel(state)}
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
        The prototype stays in-memory, keeps scenario and map data in the app layer, routes Look and Inventory through the TASK-095 read-only boundary, executes Go only through explicit exit-targeted planning plus the dedicated movement boundary, and executes Take only through explicit visible-item planning plus the dedicated pickup boundary.
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

  root.querySelectorAll<HTMLButtonElement>("[data-exit]").forEach((exitButton) => {
    exitButton.addEventListener("click", () => {
      const exitId = exitButton.getAttribute("data-exit");
      if (typeof exitId === "string" && exitId.length > 0) {
        controller.moveToExit(exitId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-inspect-location]").forEach((button) => {
    button.addEventListener("click", () => {
      controller.inspectLocation();
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-inspect-exit]").forEach((button) => {
    button.addEventListener("click", () => {
      const exitId = button.getAttribute("data-inspect-exit");
      if (typeof exitId === "string" && exitId.length > 0) {
        controller.inspectExit(exitId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-inspect-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-inspect-item");
      if (typeof itemId === "string" && itemId.length > 0) {
        controller.inspectItem(itemId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-take-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-take-item");
      if (typeof itemId === "string" && itemId.length > 0) {
        controller.pickupItem(itemId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-inspect-npc]").forEach((button) => {
    button.addEventListener("click", () => {
      const npcId = button.getAttribute("data-inspect-npc");
      if (typeof npcId === "string" && npcId.length > 0) {
        controller.inspectNpc(npcId);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-clear-inspection]").forEach((button) => {
    button.addEventListener("click", () => {
      controller.clearInspection();
      render();
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
