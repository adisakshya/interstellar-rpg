import type { CreditRow } from "./credits";

export interface TitleOptions {
  /** A saved game exists, so Continue is offered. */
  readonly hasSave: boolean;
  readonly credits: readonly CreditRow[];
  readonly onContinue: () => void;
  readonly onNewGame: () => void;
  /** Elements to take out of the Tab order and the accessibility tree while the title is up. */
  readonly behind?: readonly HTMLElement[];
}

export interface Title {
  dispose(): void;
}

/** The notice the creator asked for (D-21); shown on the title screen and again with the credits. */
export const FAN_NOTICE =
  "This is an unofficial, non-commercial fan project. It is not affiliated with, sponsored by or endorsed by the makers of the film Interstellar or anyone connected with it. It contains no film footage, stills, music or logos; the story text, sky, models and sounds are original or come from the free sources listed under Credits.";

const CSS = `
.irpg-title{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;
  padding:1.5rem;text-align:center;color:#f2f5f8;font:1rem/1.5 system-ui,sans-serif;z-index:20;pointer-events:auto;
  background:radial-gradient(ellipse at 50% 45%,rgba(3,5,10,.82),rgba(3,5,10,.5));overflow-y:auto}
.irpg-title h1{margin:0;font-size:clamp(1.5rem,6vw,3.5rem);font-weight:200;letter-spacing:.16em;text-transform:uppercase}
.irpg-title h1:focus{outline:none}
.irpg-title .irpg-tag{margin:0;max-width:34rem;font-size:1.0625rem;opacity:.9}
.irpg-title-actions{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center}
.irpg-title button{font:inherit;color:inherit;min-height:2.75rem;min-width:9rem;padding:.5rem 1.25rem;cursor:pointer;
  touch-action:manipulation;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.6);border-radius:.375rem}
.irpg-title button.irpg-primary{background:rgba(255,209,102,.16);border-color:#ffd166}
.irpg-title button:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
.irpg-title .irpg-notice{margin:0;max-width:40rem;font-size:.875rem;opacity:.9}
.irpg-title .irpg-linkish{min-width:0;border:none;background:none;text-decoration:underline;font-size:.9375rem}
.irpg-credits{max-width:44rem;width:100%;text-align:left;font-size:.875rem}
.irpg-credits[hidden]{display:none}
.irpg-credits table{width:100%;border-collapse:collapse}
.irpg-credits th,.irpg-credits td{padding:.25rem .5rem;border-bottom:1px solid rgba(255,255,255,.25);vertical-align:top}
.irpg-credits th{font-weight:600}
`;

/**
 * The title screen (FAN-001, D-21): the game's name, Continue / New game, the fan-project notice and the credits. It
 * covers the world until the player chooses, so the notice is seen before play starts. Starting over a saved game asks
 * once more, because the autosave is replaced.
 */
export function mountTitle(root: HTMLElement, options: TitleOptions): Title {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const style = el("style", CSS);
  const overlay = el("div", undefined, "irpg-title");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "irpg-title-h");

  const h1 = el("h1", "Interstellar RPG");
  h1.id = "irpg-title-h";
  h1.tabIndex = -1;
  const tag = el("p", "A fan-made game about time, gravity and the long wait of the one left behind.", "irpg-tag");

  const actions = el("div", undefined, "irpg-title-actions");
  const button = (label: string, run: () => void, primary = false) => {
    const b = el("button", label, primary ? "irpg-primary" : undefined);
    b.type = "button";
    b.addEventListener("click", run);
    return b;
  };
  const finish = (run: () => void) => () => {
    dispose();
    run();
  };
  const play = options.hasSave
    ? button("Continue", finish(options.onContinue), true)
    : button("New game", finish(options.onNewGame), true);
  actions.append(play);
  if (options.hasSave) {
    const fresh = button("New game", () => {
      if (fresh.dataset["confirm"] === "yes") {
        finish(options.onNewGame)();
        return;
      }
      fresh.dataset["confirm"] = "yes";
      fresh.textContent = "Replace my saved game?";
    });
    actions.append(fresh);
  }

  const notice = el("p", FAN_NOTICE, "irpg-notice");
  const creditsButton = button("Credits", () => {
    credits.hidden = !credits.hidden;
    creditsButton.setAttribute("aria-expanded", String(!credits.hidden));
  });
  creditsButton.className = "irpg-linkish";
  creditsButton.setAttribute("aria-expanded", "false");

  const credits = el("section", undefined, "irpg-credits");
  credits.hidden = true;
  credits.setAttribute("aria-label", "Credits");
  const table = el("table");
  const head = el("tr");
  for (const h of ["File", "What", "Author", "Licence"]) head.append(el("th", h));
  table.append(head);
  for (const row of options.credits) {
    const tr = el("tr");
    for (const cell of [row.path, row.what, row.author, row.licence]) tr.append(el("td", cell));
    table.append(tr);
  }
  credits.append(el("p", FAN_NOTICE), table);

  overlay.append(h1, tag, actions, notice, creditsButton, credits);
  root.append(style, overlay);

  const behind = options.behind ?? [];
  const inertBefore = behind.map((n) => [n, n.hasAttribute("inert"), n.style.visibility] as const);
  for (const [n] of inertBefore) {
    n.setAttribute("inert", "");
    // The world stays visible behind the title; the HUD and subtitles do not, so they cannot show through the text.
    if (n.tagName !== "CANVAS") n.style.visibility = "hidden";
  }
  play.focus({ preventScroll: true });

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [n, was, visibility] of inertBefore) {
      if (!was) n.removeAttribute("inert");
      n.style.visibility = visibility;
    }
    overlay.remove();
    style.remove();
  }
  return { dispose };
}
