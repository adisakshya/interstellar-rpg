import type { DecisionId } from "../domain";
import type { CharacterRow, DecisionPrompt, HudModel } from "./model";

export interface HudHandlers {
  onSwitch(characterId: string): void;
  onResolve(decisionId: DecisionId, optionId: string): void;
}

export interface Hud {
  update(model: HudModel): void;
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
.irpg-panel{pointer-events:auto;padding:.5rem .625rem;border-radius:.5rem;
  background:rgba(10,16,24,.84);border:1px solid rgba(255,255,255,.35)}
.irpg-panel h2{margin:0 0 .25rem;font-size:.8125rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.85}
.irpg-clock{margin:0;font-size:.9375rem}
.irpg-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.375rem}
.irpg-btn{display:flex;flex-wrap:wrap;align-items:baseline;gap:.125rem .5rem;width:100%;min-height:2.75rem;
  padding:.375rem .625rem;text-align:left;font:inherit;color:inherit;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.55);border-radius:.375rem;cursor:pointer;touch-action:manipulation}
.irpg-btn[aria-current="true"]{border:3px solid #8ecbff;background:rgba(142,203,255,.18)}
.irpg-btn[aria-disabled="true"]{border-style:dashed;opacity:.9;cursor:not-allowed}
.irpg-btn:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
.irpg-slot{font-size:.8125rem;padding:0 .25rem;border:1px solid currentColor;border-radius:.25rem}
.irpg-name{font-weight:600}
.irpg-meta{font-size:.875rem;opacity:.9}
.irpg-reason{flex-basis:100%;font-size:.875rem;font-weight:600}
.irpg-you{font-size:.8125rem;font-weight:600}
.irpg-prompt{border:2px solid #ffd166}
.irpg-prompt p{margin:.25rem 0 .5rem}
.irpg-options{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.375rem}
.irpg-options>li{flex:1 1 8rem}
.irpg-note{margin:0;font-size:.875rem}
.irpg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
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
  timePanel.append(clock, clockSpoken);

  const roster = make(doc, "nav", { class: "irpg-panel", "aria-labelledby": "irpg-who-h" });
  roster.append(make(doc, "h2", { id: "irpg-who-h" }, "Characters"));
  const list = make(doc, "ul", { class: "irpg-list" });
  roster.append(list);

  const notes = make(doc, "section", { class: "irpg-panel", "aria-label": "Waiting on others", hidden: "" });
  const prompts = make(doc, "div", { role: "group", "aria-label": "Decisions" });
  prompts.style.display = "flex";
  prompts.style.flexDirection = "column";
  prompts.style.gap = ".5rem";
  const status = make(doc, "div", { class: "irpg-sr", role: "status", "aria-live": "polite" });

  const column = make(doc, "div", { class: "irpg-scroll" });
  column.append(timePanel, roster, prompts, notes);
  wrap.append(column, status);
  root.append(style, wrap);

  const rows = new Map<string, RowView>();
  const promptViews = new Map<string, HTMLElement>();
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

  function buildPrompt(p: DecisionPrompt): HTMLElement {
    const box = make(doc, "section", {
      class: "irpg-panel irpg-prompt",
      role: "group",
      "aria-labelledby": `irpg-d-${p.id}`,
    });
    box.append(
      make(doc, "h2", { id: `irpg-d-${p.id}` }, p.hard ? "Decision (time stops at the deadline)" : "Decision"),
    );
    box.append(make(doc, "p", {}, p.title));
    if (p.deadline) box.append(make(doc, "p", { class: "irpg-note" }, `Deadline in ${p.deadline} of reference time`));
    const options = make(doc, "ul", { class: "irpg-options" });
    for (const o of p.options) {
      const li = make(doc, "li");
      const b = make(doc, "button", { type: "button", class: "irpg-btn" }, o.label);
      b.addEventListener("click", () => handlers.onResolve(p.id, o.id));
      li.append(b);
      options.append(li);
    }
    box.append(options);
    return box;
  }

  return {
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

      // Decision prompts: created when they appear, removed when resolved; never rebuilt while open.
      const live = new Set(model.prompts.map((p) => p.id as string));
      let focusFirst: HTMLElement | null = null;
      for (const p of model.prompts) {
        if (!promptViews.has(p.id)) {
          const box = buildPrompt(p);
          promptViews.set(p.id, box);
          prompts.append(box);
          focusFirst ??= box.querySelector("button");
          announce(
            `Decision for ${model.controlledName}: ${p.title}. ${p.deadlineSpoken ? `Deadline in ${p.deadlineSpoken}. ` : ""}Options: ${p.options.map((o) => o.label).join(", ")}.`,
          );
        }
      }
      for (const [id, box] of promptViews) {
        if (!live.has(id)) {
          box.remove();
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
