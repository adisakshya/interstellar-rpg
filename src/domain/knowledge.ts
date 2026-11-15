import type { EventDraft } from "./commands";
import type { HandlerMap, HandlerOutcome } from "./engine";
import type { CharacterId, FactId, LocationId } from "./ids";
import type { TimeTables } from "./rules";
import type { GameState, MessageState } from "./state";

type Rejected = Extract<HandlerOutcome, { kind: "rejected" }>;
const reject = (code: Rejected["code"], detail?: string): Rejected =>
  detail === undefined ? { kind: "rejected", code } : { kind: "rejected", code, detail };

/**
 * `characterId` learns `factId` through a committed in-world event (INV-08). The player sees it too when that
 * character is the one being controlled. A dead character learns nothing.
 */
export function learn(
  state: GameState,
  characterId: CharacterId,
  factId: FactId,
): { state: GameState; events: EventDraft[] } {
  const c = state.characters[characterId];
  if (!c || c.unavailable === "DEAD") return { state, events: [] };
  let s = state;
  // The player sees what the controlled character observes, even a fact that character already knew.
  if (characterId === s.controlled && !s.playerSeen.includes(factId)) {
    s = { ...s, playerSeen: [...s.playerSeen, factId] };
  }
  const known = s.knowledge[characterId] ?? [];
  if (known.includes(factId)) return { state: s, events: [] };
  s = { ...s, knowledge: { ...s.knowledge, [characterId]: [...known, factId] } };
  return { state: s, events: [{ kind: "FactLearned", T: s.T, characterId, factId }] };
}

/** Commit a message's delivery at the current T: MessageDelivered, then the receiver learns its facts (INV-09). */
export function deliver(state: GameState, message: MessageState): { state: GameState; events: EventDraft[] } {
  let s: GameState = {
    ...state,
    messages: state.messages.map((m) => (m.id === message.id ? { ...m, delivered: true } : m)),
  };
  const events: EventDraft[] = [{ kind: "MessageDelivered", T: s.T, messageId: message.id }];
  for (const factId of message.factIds) {
    const out = learn(s, message.to, factId);
    s = out.state;
    events.push(...out.events);
  }
  return { state: s, events };
}

/** Facts the player has seen that `characterId` does not know ("You know this. Romilly doesn't."). */
export function playerOnlyFacts(state: GameState, characterId: CharacterId): readonly FactId[] {
  const known = state.knowledge[characterId] ?? [];
  return state.playerSeen.filter((f) => !known.includes(f));
}

/** SendMessage (TIMELINES §6): same place is a conversation; otherwise a content link with a latency on T. */
export function createKnowledgeHandlers(tables: TimeTables): Pick<HandlerMap, "SendMessage"> {
  const linkBetween = (a: LocationId, b: LocationId) =>
    (tables.links ?? []).find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));

  return {
    SendMessage(state, command) {
      const from = state.characters[command.fromId];
      const to = state.characters[command.toId];
      if (!from) return reject("INVALID", `unknown character ${command.fromId}`);
      if (!to || command.toId === command.fromId) return reject("INVALID", `bad receiver ${command.toId}`);
      if (command.fromId !== state.controlled) return reject("NOT_CONTROLLED");
      if (from.unavailable !== null && from.unavailable !== "LOCKED_SEQUENCE")
        return reject("CHARACTER_UNAVAILABLE", from.unavailable);
      if (to.unavailable === "DEAD") return reject("CHARACTER_UNAVAILABLE", "DEAD");
      if (command.factIds.length === 0) return reject("INVALID", "a message carries at least one fact");
      const known = state.knowledge[command.fromId] ?? [];
      for (const f of command.factIds) {
        if (tables.facts && !tables.facts.includes(f)) return reject("INVALID", `unknown fact ${f}`);
        // A character can only pass on what they know themselves (INV-08).
        if (!known.includes(f)) return reject("INVALID", `${command.fromId} does not know ${f}`);
      }

      let latency = 0;
      if (from.location !== to.location) {
        const link = linkBetween(from.location, to.location);
        if (!link || !link.up) return reject("INVALID", `no link between ${from.location} and ${to.location}`);
        latency = link.latency;
      }
      const message: MessageState = {
        id: `msg.${command.commandId}`,
        from: command.fromId,
        to: command.toId,
        factIds: [...new Set(command.factIds)],
        sentT: state.T,
        deliverT: state.T + latency,
        delivered: false,
      };
      const s: GameState = { ...state, messages: [...state.messages, message] };
      const events: EventDraft[] = [{ kind: "MessageSent", T: s.T, messageId: message.id }];
      if (latency > 0) return { kind: "commit", state: s, events };
      const out = deliver(s, message);
      return { kind: "commit", state: out.state, events: [...events, ...out.events] };
    },
  };
}
