import type { OutcomeModel } from "./outcome";

export interface OutcomeAction {
  readonly label: string;
  run(): void;
}
export interface OutcomeView {
  dispose(): void;
}

const CSS = `
.irpg-outcome{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;
  padding:1rem;background:rgba(5,8,14,.9);color:#f2f5f8;font:1rem/1.45 system-ui,sans-serif;z-index:10;pointer-events:auto}
.irpg-outcome-card{width:min(36rem,100%);padding:1rem;border:1px solid rgba(255,255,255,.4);border-radius:.5rem;
  background:rgba(14,22,34,.98)}
.irpg-outcome h1{margin:0 0 .5rem;font-size:1.5rem;font-weight:300;letter-spacing:.06em}
.irpg-outcome h1:focus{outline:none}
.irpg-outcome h2{margin:1rem 0 .25rem;font-size:.9375rem;letter-spacing:.04em;text-transform:uppercase;opacity:.85}
.irpg-outcome p,.irpg-outcome ul{margin:0}
.irpg-outcome ul{padding-left:1.25rem}
.irpg-outcome table{width:100%;border-collapse:collapse}
.irpg-outcome th,.irpg-outcome td{padding:.25rem .5rem .25rem 0;text-align:left;vertical-align:top}
.irpg-outcome th{font-weight:600}
.irpg-outcome-actions{display:flex;flex-direction:column;gap:.5rem;margin-top:1rem}
.irpg-outcome button{min-height:2.75rem;padding:.5rem .75rem;text-align:left;font:inherit;color:inherit;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.55);border-radius:.375rem;cursor:pointer;
  touch-action:manipulation}
.irpg-outcome button:focus-visible{outline:3px solid #8ecbff;outline-offset:2px}
`;

/**
 * The end-of-episode dialog: who experienced how much time, what is known, why it turned out this way, and ways to
 * try again. Focus moves to its title when it opens, and the page behind is made inert.
 */
export function mountOutcome(
  root: HTMLElement,
  model: OutcomeModel,
  actions: readonly OutcomeAction[],
  behind: readonly HTMLElement[] = [],
): OutcomeView {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const n = doc.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const style = el("style", CSS);
  const overlay = el("div", undefined, "irpg-outcome");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "irpg-outcome-h");
  const card = el("div", undefined, "irpg-outcome-card");
  const h1 = el("h1", model.title);
  h1.id = "irpg-outcome-h";
  card.append(h1, el("p", `${model.reference} passed overall.`));

  const section = (title: string, ...children: HTMLElement[]) => {
    if (children.length === 0) return;
    card.append(el("h2", title), ...children);
  };

  const table = el("table");
  const head = el("tr");
  for (const c of ["Who", "Time lived", "State"]) {
    const th = el("th", c);
    th.scope = "col";
    head.append(th);
  }
  table.append(head);
  for (const r of model.rows) {
    const tr = el("tr");
    const who = el("th", r.name);
    who.scope = "row";
    const lived = el("td", r.lived);
    lived.setAttribute("aria-label", r.livedSpoken);
    tr.append(who, lived, el("td", r.status));
    table.append(tr);
  }
  section("Who experienced how much time", table);

  const list = (items: readonly string[]) => {
    const ul = el("ul");
    for (const i of items) ul.append(el("li", i));
    return ul;
  };
  section("Why it turned out this way", ...(model.notes.length ? [list(model.notes)] : []));
  section("What is known", ...(model.known.length ? [list(model.known)] : []));
  section("What is left", ...(model.resources.length ? [list(model.resources)] : []));

  const row = el("div", undefined, "irpg-outcome-actions");
  for (const a of actions) {
    const b = el("button", a.label);
    b.type = "button";
    b.addEventListener("click", a.run);
    row.append(b);
  }
  card.append(row);
  overlay.append(card);
  root.append(style, overlay);

  // `inert` takes the page behind out of both the Tab order and the accessibility tree.
  const inertBefore = behind.map((n) => [n, n.hasAttribute("inert")] as const);
  for (const [n] of inertBefore) n.setAttribute("inert", "");
  // Focus the title, not the first button below the fold: the dialog opens at its top and screen readers read it from
  // the start. The next Tab reaches the first action.
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
  overlay.scrollTop = 0;

  return {
    dispose() {
      for (const [n, was] of inertBefore) if (!was) n.removeAttribute("inert");
      style.remove();
      overlay.remove();
    },
  };
}
