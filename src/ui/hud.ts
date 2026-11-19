import type { DecisionId } from "../domain";
import type { CharacterRow, DecisionPrompt, HudModel } from "./model";

export interface HudHandlers {
  onSwitch(characterId: string): void;
  onResolve(decisionId: DecisionId, optionId: string): void;
  /** The player chose the offered interaction (same as pressing E or the Act button). */
  onAct(): void;
  /** The player pressed the sound switch. When absent, no switch is drawn. */
  onToggleSound?(): void;
}

export interface Hud {
  update(model: HudModel): void;
  /** A spot at the top of the HUD column where narrow screens put the subtitles, so they never cover a decision. */
  readonly slot: HTMLElement;
  /** The current goal while the player is not yet where the offered action is ("Walk to the beacon · 31 m"), or null. */
  setObjective(text: string | null): void;
  /** Update the sound switch's label. */
  setSound(on: boolean): void;
  /** Flash the tick dot: the visual cue for the time tick, for players without sound. */
  pulse(): void;
  /** Say something through the polite live region (for example "12 days passed for Romilly"). */
  announce(text: string): void;
  /** Show "Paused" while the game is paused by the UI (hidden tab, lost graphics context). Not a physical time stop. */
  setPaused(paused: boolean): void;
  dispose(): void;
}

const CSS = `
.irpg-hud{position:absolute;inset:0;padding:.5rem;box-sizing:border-box;pointer-events:none;
  font:1rem/1.35 system-ui,sans-serif;color:#f2f5f8}
/* One column that scrolls when it is taller than the space above the touch controls (pad 8rem + margins). */
.irpg-scroll{display:flex;flex-direction:column;gap:.5rem;width:min(22rem,100%);max-height:calc(100% - 10.5rem);
  overflow-y:auto;overscroll-behavior:contain;pointer-events:none}
.irpg-scroll>*{flex:none;width:100%}
.irpg-hud *{box-sizing:border-box}
.irpg-panel{pointer-events:auto;padding:.5rem .75rem;border-radius:.75rem;
  background:rgba(8,12,18,.74);border:1px solid rgba(255,255,255,.2);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 .25rem 1.25rem rgba(0,0,0,.35)}
/* Section headings stay for screen readers but are not drawn: the panels explain themselves. A decision keeps its heading. */
.irpg-panel>h2{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.irpg-prompt>h2{position:static;width:auto;height:auto;margin:0 0 .25rem;clip:auto;overflow:visible;white-space:normal;
  font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#ffd166}
.irpg-clock{margin:0;font-size:.9375rem}
.irpg-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.375rem}
.irpg-btn{display:flex;flex-wrap:wrap;align-items:baseline;gap:.125rem .5rem;width:100%;min-height:2.75rem;
  padding:.375rem .625rem;text-align:left;font:inherit;color:inherit;background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.4);border-radius:.5rem;cursor:pointer;touch-action:manipulation}
.irpg-btn:hover{background:rgba(255,255,255,.14)}
.irpg-btn[aria-current="true"]{border:3px solid #8ecbff;background:rgba(142,203,255,.18)}
.irpg-btn[aria-disabled="true"]{border-style:dashed;opacity:.9;cursor:not-allowed}
.irpg-btn:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
.irpg-slot{font-size:.8125rem;padding:0 .25rem;border:1px solid currentColor;border-radius:.25rem}
.irpg-name{font-weight:600}
.irpg-meta{font-size:.875rem;opacity:.9}
.irpg-reason{flex-basis:100%;font-size:.875rem;font-weight:600}
.irpg-you{font-size:.8125rem;font-weight:600}
.irpg-prompt{border:1px solid #ffd166;box-shadow:0 0 1.5rem rgba(255,209,102,.18)}
.irpg-prompt p{margin:.25rem 0 .5rem}
.irpg-options{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.375rem}
.irpg-options>li{flex:1 1 8rem}
.irpg-note{margin:0;font-size:.875rem}
.irpg-objective-text{margin:0;font-size:1rem;font-weight:500}
.irpg-objective-text::before{content:"\\25B8";margin-right:.5rem;color:#ffd166}
.irpg-stake{margin:.25rem 0 .5rem;font-size:.9375rem}
.irpg-timerow{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.irpg-timerow .irpg-btn{width:auto;flex:none;align-items:center}
.irpg-tick{display:inline-block;width:.5rem;height:.5rem;margin-right:.5rem;border-radius:50%;background:#ffd166;opacity:.2;transition:opacity .35s ease-out}
.irpg-tick.irpg-on{opacity:1;transition:none}
.irpg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* Wide screens with a mouse: the roster is a row of chips and the offered action is a prompt at the bottom of the view,
   like the context action in a game, with the E key drawn on it. */
@media (min-width:48rem) and (pointer:fine){
  .irpg-scroll{width:min(30rem,100%)}
  .irpg-list{flex-direction:row;flex-wrap:wrap;gap:.375rem}
  .irpg-list>li{flex:1 1 8rem}
  .irpg-actionbar{position:fixed;left:50%;bottom:8.5rem;transform:translateX(-50%);width:min(30rem,calc(100% - 2rem));
    border-color:rgba(255,209,102,.7);background:rgba(8,12,18,.82)}
  .irpg-actionbar .irpg-btn{border-color:rgba(255,255,255,.25);background:rgba(255,209,102,.1)}
  .irpg-actionbar .irpg-btn::before{content:"E";display:inline-flex;align-items:center;justify-content:center;
    min-width:1.5rem;height:1.5rem;margin-right:.375rem;border:1px solid #ffd166;border-radius:.3rem;color:#ffd166;
    font-size:.8125rem;font-weight:700}
}
/* Narrow or touch screens (UI-002): the world is the point, so the HUD shrinks to a strip. Headings stay for screen
   readers but are not drawn, the roster becomes a row of chips, and nothing loses its text or its focus ring. */
@media (max-width:40rem),(pointer:coarse) and (max-height:34rem){
  .irpg-hud{padding:.375rem;font-size:.875rem}
  /* The offered action sits just above the thumbs, not at the top over the sky. */
  /* A decision sits above the thumbs too, so the sky and the horizon (and the wave on it) stay in view above it. */
  .irpg-decisions{position:fixed;left:.5rem;right:.5rem;bottom:10.5rem;width:auto;max-height:52vh;overflow-y:auto;pointer-events:none}
  .irpg-decisions>*{pointer-events:auto}
  .irpg-actionbar{position:fixed;left:.5rem;right:.5rem;bottom:10.5rem;width:auto;background:rgba(8,12,18,.82);border-color:rgba(255,209,102,.7)}
  .irpg-scroll{gap:.25rem;max-height:calc(100% - 9rem)}
  .irpg-panel{padding:.25rem .5rem;border-radius:.375rem}
  .irpg-clock{font-size:.8125rem}
  .irpg-btn{min-height:2.75rem;padding:.25rem .5rem;gap:0 .375rem}
  .irpg-list{flex-direction:row;flex-wrap:wrap;gap:.25rem}
  .irpg-list>li{flex:1 1 8rem}
  .irpg-meta{font-size:.8125rem}
}
`;

type Attrs = Record<string, string>;
function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Attrs = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

interface RowView {
  li: HTMLLIElement;
  button: HTMLButtonElement;
  slot: HTMLElement;
  name: HTMLElement;
  you: HTMLElement;
  meta: HTMLElement;
  reason: HTMLElement;
}

/**
 * Mount the HUD as a DOM overlay (ADR-005, FR-03, NFR-04). Elements are updated in place, so keyboard focus survives
 * every state change. Reasons are always text; the controlled character is marked by text and `aria-current`, never
 * by colour alone. A polite live region announces switches and new decisions rather than every tick.
 */
export function mountHud(root: HTMLElement, handlers: HudHandlers): Hud {
  const doc = root.ownerDocument;
  const style = make(doc, "style");
  style.textContent = CSS;
  const wrap = make(doc, "div", { class: "irpg-hud" });

  const timePanel = make(doc, "section", { class: "irpg-panel", "aria-labelledby": "irpg-time-h" });
  timePanel.append(make(doc, "h2", { id: "irpg-time-h" }, "Time"));
  const clock = make(doc, "p", { class: "irpg-clock" });
  const clockSpoken = make(doc, "span", { class: "irpg-sr" });
  const pausedNote = make(doc, "p", { class: "irpg-note irpg-paused", hidden: "" }, "Paused");
  const tickDot = make(doc, "span", { class: "irpg-tick", "aria-hidden": "true" });
  const soundButton = make(doc, "button", { type: "button", class: "irpg-btn", "aria-pressed": "true" });
  soundButton.textContent = "Sound on";
  const timeRow = make(doc, "div", { class: "irpg-timerow" });
  const clockBox = make(doc, "div");
  clockBox.append(clock, clockSpoken);
  const rowEnd = make(doc, "div");
  rowEnd.style.display = "flex";
  rowEnd.style.alignItems = "center";
  rowEnd.append(tickDot);
  if (handlers.onToggleSound) {
    soundButton.addEventListener("click", () => handlers.onToggleSound?.());
    rowEnd.append(soundButton);
  }
  timeRow.append(clockBox, rowEnd);
  timePanel.append(timeRow, pausedNote);

  const actionPanel = make(doc, "section", {
    class: "irpg-panel irpg-actionbar",
    "aria-labelledby": "irpg-act-h",
    hidden: "",
  });
  actionPanel.append(make(doc, "h2", { id: "irpg-act-h" }, "Action"));
  const actionButton = make(doc, "button", { type: "button", class: "irpg-btn", "aria-keyshortcuts": "E" });
  const actionLabel = make(doc, "span", { class: "irpg-name" });
  const actionCost = make(doc, "span", { class: "irpg-meta" });
  actionButton.append(actionLabel, actionCost);
  actionButton.addEventListener("click", () => handlers.onAct());
  actionPanel.append(actionButton);

  const objectivePanel = make(doc, "section", {
    class: "irpg-panel irpg-actionbar irpg-objective",
    "aria-label": "Objective",
    hidden: "",
  });
  const objectiveText = make(doc, "p", { class: "irpg-objective-text" });
  objectivePanel.append(objectiveText);

  const roster = make(doc, "nav", { class: "irpg-panel", "aria-labelledby": "irpg-who-h" });
  roster.append(make(doc, "h2", { id: "irpg-who-h" }, "Characters"));
  const list = make(doc, "ul", { class: "irpg-list" });
  roster.append(list);

  const notes = make(doc, "section", { class: "irpg-panel", "aria-label": "Waiting on others", hidden: "" });
  const prompts = make(doc, "div", { role: "group", "aria-label": "Decisions", class: "irpg-decisions" });
  prompts.style.display = "flex";
  prompts.style.flexDirection = "column";
  prompts.style.gap = ".5rem";
  const status = make(doc, "div", { class: "irpg-sr", role: "status", "aria-live": "polite" });

  const column = make(doc, "div", { class: "irpg-scroll" });
  const slot = make(doc, "div", { hidden: "" });
  column.append(slot, timePanel, actionPanel, objectivePanel, roster, prompts, notes);
  wrap.append(column, status);
  root.append(style, wrap);

  const rows = new Map<string, RowView>();
  const promptViews = new Map<string, { box: HTMLElement; deadline: HTMLElement }>();
  let previous: HudModel | null = null;
  let announceSeq = 0;
  const announce = (text: string) => {
    // Alternate a trailing space so repeating the same sentence is still announced.
    status.textContent = text + (announceSeq++ % 2 ? " " : "");
  };

  function rowFor(row: CharacterRow): RowView {
    let view = rows.get(row.id);
    if (view) return view;
    const button = make(doc, "button", { type: "button", class: "irpg-btn" });
    const slot = make(doc, "span", { class: "irpg-slot", "aria-hidden": "true" });
    const name = make(doc, "span", { class: "irpg-name" });
    const you = make(doc, "span", { class: "irpg-you" });
    const meta = make(doc, "span", { class: "irpg-meta" });
    const reason = make(doc, "span", { class: "irpg-reason" });
    button.append(slot, name, you, meta, reason);
    button.addEventListener("click", () => {
      const current = previous?.characters.find((c) => c.id === row.id);
      if (!current || current.controlled) return;
      if (current.switchable) handlers.onSwitch(row.id);
      else announce(`${current.name} is unavailable: ${current.reasonText}`);
    });
    const li = make(doc, "li");
    li.append(button);
    view = { li, button, slot, name, you, meta, reason };
    rows.set(row.id, view);
    return view;
  }

  function paintRow(row: CharacterRow, view: RowView) {
    view.slot.textContent = String(row.slot);
    view.name.textContent = row.name;
    view.you.textContent = row.controlled ? "(you)" : "";
    view.meta.textContent = `${row.lived} lived`;
    view.reason.textContent = row.reasonText;
    view.reason.hidden = row.reasonText === "";
    const unavailable = !row.controlled && !row.switchable;
    view.button.setAttribute("aria-disabled", String(unavailable));
    if (row.controlled) view.button.setAttribute("aria-current", "true");
    else view.button.removeAttribute("aria-current");
    view.button.setAttribute("aria-keyshortcuts", String(row.slot));
    view.button.setAttribute(
      "aria-label",
      [
        row.name,
        row.controlled ? "you are controlling" : "",
        `${row.livedSpoken} lived`,
        row.reasonText ? `unavailable: ${row.reasonText}` : "",
      ]
        .filter(Boolean)
        .join(", "),
    );
  }

  function buildPrompt(p: DecisionPrompt): { box: HTMLElement; deadline: HTMLElement } {
    const box = make(doc, "section", {
      class: "irpg-panel irpg-prompt",
      role: "group",
      "aria-labelledby": `irpg-d-${p.id}`,
    });
    box.append(
      make(doc, "h2", { id: `irpg-d-${p.id}` }, p.hard ? "Decision (time stops at the deadline)" : "Decision"),
    );
    box.append(make(doc, "p", {}, p.title));
    if (p.prompt) box.append(make(doc, "p", { class: "irpg-stake" }, p.prompt));
    const deadline = make(doc, "p", { class: "irpg-note" });
    paintDeadline(deadline, p);
    box.append(deadline);
    const options = make(doc, "ul", { class: "irpg-options" });
    for (const o of p.options) {
      const li = make(doc, "li");
      const b = make(doc, "button", { type: "button", class: "irpg-btn" }, o.label);
      b.addEventListener("click", () => handlers.onResolve(p.id, o.id));
      li.append(b);
      options.append(li);
    }
    box.append(options);
    return { box, deadline };
  }

  /** The countdown changes as reference time advances, so it is repainted on every update, never rebuilt. */
  function paintDeadline(el: HTMLElement, p: DecisionPrompt): void {
    el.textContent = p.deadline
      ? `Deadline in ${p.deadline} of reference time`
      : p.hard
        ? "Time is held until you choose."
        : "";
    el.hidden = !p.deadline && !p.hard;
  }

  return {
    slot,
    setObjective(text) {
      if (text === null) {
        objectivePanel.hidden = true;
        return;
      }
      if (objectiveText.textContent !== text) objectiveText.textContent = text;
      objectivePanel.hidden = false;
    },
    setSound(on) {
      soundButton.textContent = on ? "Sound on" : "Sound off";
      soundButton.setAttribute("aria-pressed", String(on));
    },
    pulse() {
      tickDot.classList.add("irpg-on");
      setTimeout(() => tickDot.classList.remove("irpg-on"), 90);
    },
    announce,
    setPaused(paused) {
      if (pausedNote.hidden === !paused) return;
      pausedNote.hidden = !paused;
      announce(paused ? "Paused" : "Resumed");
    },
    update(model) {
      // Roster: keyed, in place.
      const seen = new Set<string>();
      model.characters.forEach((row, i) => {
        const view = rowFor(row);
        paintRow(row, view);
        seen.add(row.id);
        if (list.children[i] !== view.li) list.insertBefore(view.li, list.children[i] ?? null);
      });
      for (const [id, view] of rows) {
        if (!seen.has(id)) {
          view.li.remove();
          rows.delete(id);
        }
      }

      clock.textContent = `${model.controlledName} · ${model.reference} passed overall`;
      clockSpoken.textContent = `Reference time ${model.referenceSpoken}`;

      // The offered action: one button repainted in place, so focus stays on it while its cost changes.
      actionPanel.hidden = model.action === null;
      if (model.action) {
        actionLabel.textContent = model.action.label;
        actionCost.textContent = model.action.cost;
        actionButton.setAttribute("aria-label", `${model.action.label}, ${model.action.costSpoken}`);
      }

      // Decision prompts: created when they appear, removed when resolved; never rebuilt while open.
      const live = new Set(model.prompts.map((p) => p.id as string));
      let focusFirst: HTMLElement | null = null;
      for (const p of model.prompts) {
        const existing = promptViews.get(p.id);
        if (existing) {
          paintDeadline(existing.deadline, p);
        } else {
          const view = buildPrompt(p);
          promptViews.set(p.id, view);
          prompts.append(view.box);
          focusFirst ??= view.box.querySelector("button");
          announce(
            `Decision for ${model.controlledName}: ${p.title}. ${p.prompt ? `${p.prompt} ` : ""}${p.deadlineSpoken ? `Deadline in ${p.deadlineSpoken}. ` : ""}Options: ${p.options.map((o) => o.label).join(", ")}.`,
          );
        }
      }
      for (const [id, view] of promptViews) {
        if (!live.has(id)) {
          view.box.remove();
          promptViews.delete(id);
        }
      }
      focusFirst?.focus();

      // Decisions waiting on someone else.
      notes.replaceChildren(...model.waiting.map((w) => make(doc, "p", { class: "irpg-note" }, w.text)));
      notes.hidden = model.waiting.length === 0;
      const before = new Set(previous?.waiting.map((w) => w.id));
      for (const w of model.waiting) if (!before.has(w.id)) announce(`${w.text}. Switch to decide.`);

      if (previous && previous.controlledName !== model.controlledName)
        announce(`Now controlling ${model.controlledName}`);
      previous = model;
    },
    dispose() {
      style.remove();
      wrap.remove();
      rows.clear();
      promptViews.clear();
    },
  };
}
