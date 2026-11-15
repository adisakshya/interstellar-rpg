export interface NoticeAction {
  readonly label: string;
  run(): void;
}
export interface Notice {
  dispose(): void;
}

const CSS = `
.irpg-notice{position:absolute;top:.5rem;right:.5rem;max-width:min(24rem,calc(100% - 1rem));padding:.625rem .75rem;
  border-radius:.5rem;background:rgba(40,20,10,.94);border:2px solid #ffcf70;color:#fff;font:1rem/1.4 system-ui,sans-serif;
  pointer-events:auto;z-index:5}
.irpg-notice p{margin:0 0 .5rem}
.irpg-notice .irpg-notice-row{display:flex;flex-wrap:wrap;gap:.5rem}
.irpg-notice button{min-height:2.75rem;min-width:2.75rem;padding:.375rem .75rem;font:inherit;color:inherit;background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.7);border-radius:.375rem;cursor:pointer;touch-action:manipulation}
.irpg-notice button:focus-visible{outline:3px solid #8ecbff;outline-offset:2px}
`;

/**
 * A dismissible message on top of the game, announced to screen readers when it appears. Used for save problems,
 * where the player needs to read what happened and may need to act on it.
 */
export function mountNotice(root: HTMLElement, message: string, actions: readonly NoticeAction[] = []): Notice {
  const doc = root.ownerDocument;
  const style = doc.createElement("style");
  style.textContent = CSS;
  const box = doc.createElement("div");
  box.className = "irpg-notice";
  box.setAttribute("role", "alert");
  const text = doc.createElement("p");
  text.textContent = message;
  const row = doc.createElement("div");
  row.className = "irpg-notice-row";
  const button = (label: string, run: () => void) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", run);
    row.append(b);
  };
  for (const a of actions) button(a.label, a.run);
  const dispose = () => {
    style.remove();
    box.remove();
  };
  button("Dismiss", dispose);
  box.append(text, row);
  root.append(style, box);
  return { dispose };
}
