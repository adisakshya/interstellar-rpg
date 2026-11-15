/** What the subtitle view needs from the story controller (kept structural so `ui` does not import `app`). */
export interface StorySource {
  current(): {
    readonly name: string | null;
    readonly kind: "speech" | "narrator" | "ship" | "card";
    readonly text: string;
  } | null;
  log(): readonly { readonly name: string | null; readonly kind: string; readonly text: string }[];
  pending(): number;
  next(): void;
  skipAll(): void;
  readonly autoAdvance: boolean;
  setAutoAdvance(value: boolean): void;
  subscribe(listener: () => void): () => void;
}

export interface SubtitleOptions {
  /** Where narrow or touch screens dock the panel (the HUD's own column), so it cannot cover a decision. */
  readonly slot?: HTMLElement;
  /** True on a wide screen with a mouse, where the panel sits bottom centre like film subtitles. */
  readonly wide?: () => boolean;
}

export interface Subtitles {
  dispose(): void;
}

const CSS = `
.irpg-sub{pointer-events:auto;box-sizing:border-box;padding:.625rem .75rem;border-radius:.5rem;
  background:rgba(6,10,16,.82);border:1px solid rgba(255,255,255,.3);color:#f2f5f8;font:1rem/1.45 system-ui,sans-serif}
.irpg-sub.irpg-floating{position:absolute;left:50%;transform:translateX(-50%);bottom:1.25rem;width:min(44rem,calc(100% - 2rem))}
.irpg-sub[hidden]{display:none}
.irpg-sub-line{margin:0;min-height:1.45em}
.irpg-sub-name{font-weight:600;letter-spacing:.03em;margin-right:.5rem;color:#ffd9a0}
.irpg-sub-narrator .irpg-sub-text{font-style:italic;opacity:.92}
.irpg-sub-card{text-align:center}
.irpg-sub-card .irpg-sub-text{display:block;font-size:1.35rem;font-weight:300;letter-spacing:.04em;padding:.5rem 0}
.irpg-sub-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-top:.5rem;font-size:.875rem}
.irpg-sub-ctl button{font:inherit;color:inherit;min-height:2.25rem;padding:.25rem .75rem;cursor:pointer;touch-action:manipulation;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.5);border-radius:.375rem}
.irpg-sub-ctl button:focus-visible,.irpg-sub-ctl input:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
.irpg-sub-ctl label{display:flex;align-items:center;gap:.375rem;margin-left:auto}
.irpg-sub-log{margin:.5rem 0 0;padding:0 0 0 1.25rem;max-height:9rem;overflow-y:auto;font-size:.875rem;opacity:.9}
`;

/**
 * Subtitles for the story (STORY-001, art direction §3): thin type on a translucent dark panel. One line at a time; it
 * moves on by itself after a reading time, and every control works from the keyboard. Auto-advance can be turned off
 * (WCAG 2.2.1), and everything said stays in a log. The text sits in a polite live region, so a screen reader hears
 * each line once.
 */
export function mountSubtitles(root: HTMLElement, story: StorySource, options: SubtitleOptions = {}): Subtitles {
  const doc = root.ownerDocument;
  const style = doc.createElement("style");
  style.textContent = CSS;

  const panel = doc.createElement("section");
  panel.className = "irpg-sub";
  panel.setAttribute("aria-label", "Story");
  panel.hidden = true;

  const lineBox = doc.createElement("p");
  lineBox.className = "irpg-sub-line";
  lineBox.setAttribute("role", "status");
  lineBox.setAttribute("aria-live", "polite");
  const name = doc.createElement("span");
  name.className = "irpg-sub-name";
  const text = doc.createElement("span");
  text.className = "irpg-sub-text";
  lineBox.append(name, text);

  const controls = doc.createElement("div");
  controls.className = "irpg-sub-ctl";
  const button = (label: string, run: () => void) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", run);
    return b;
  };
  const next = button("Continue", () => story.next());
  const skip = button("Skip all", () => story.skipAll());
  const logToggle = button("Log", () => {
    logOpen = !logOpen;
    paint();
  });
  logToggle.setAttribute("aria-expanded", "false");
  const autoLabel = doc.createElement("label");
  const auto = doc.createElement("input");
  auto.type = "checkbox";
  auto.addEventListener("change", () => story.setAutoAdvance(auto.checked));
  autoLabel.append(auto, doc.createTextNode("Move on by itself"));
  controls.append(next, skip, logToggle, autoLabel);

  const logList = doc.createElement("ol");
  logList.className = "irpg-sub-log";
  logList.hidden = true;
  logList.setAttribute("aria-label", "Story so far");

  panel.append(lineBox, controls, logList);
  root.append(style);

  let logOpen = false;
  let docked: "slot" | "float" | null = null;

  const place = () => {
    const wide = options.wide?.() === true || options.slot === undefined;
    const want = wide ? "float" : "slot";
    if (docked === want) return;
    docked = want;
    if (want === "float") {
      panel.classList.add("irpg-floating");
      root.append(panel);
    } else {
      panel.classList.remove("irpg-floating");
      options.slot?.append(panel);
    }
  };

  const paint = () => {
    const line = story.current();
    const hasLog = story.log().length > 0;
    place();
    // With no line on screen the panel shrinks to the log button, so what was said can still be read (and what was
    // skipped can be caught up on) between scenes.
    panel.hidden = line === null && !hasLog;
    if (options.slot) options.slot.hidden = docked !== "slot" || panel.hidden;
    if (panel.hidden) return;
    const kind = line?.kind ?? "narrator";
    panel.className = `irpg-sub irpg-sub-${kind}${docked === "float" ? " irpg-floating" : ""}`;
    lineBox.hidden = line === null;
    name.textContent = line?.name ?? "";
    name.hidden = line?.name == null;
    text.textContent = line?.text ?? "";
    next.hidden = line === null;
    next.textContent = story.pending() > 0 ? "Continue" : "Close";
    skip.hidden = line === null || story.pending() === 0;
    autoLabel.hidden = line === null;
    auto.checked = story.autoAdvance;
    logToggle.textContent = line === null ? "Story log" : "Log";
    logToggle.setAttribute("aria-expanded", String(logOpen));
    logList.hidden = !logOpen;
    if (logOpen) {
      logList.replaceChildren(
        ...story.log().map((l) => {
          const li = doc.createElement("li");
          li.textContent = l.name === null ? l.text : `${l.name}: ${l.text}`;
          return li;
        }),
      );
      logList.scrollTop = logList.scrollHeight;
    }
  };

  const unsubscribe = story.subscribe(paint);
  paint();
  return {
    dispose() {
      unsubscribe();
      panel.remove();
      style.remove();
    },
  };
}
