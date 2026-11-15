// Save slots, IndexedDB, export/import, migrations (SAVE-001, ADR-003). Imports the domain only.
export { canonicalJson, sha256Hex, stateHash } from "./canonical";
export { decodeSave, encodeSave, EVENT_TAIL_LIMIT, MIGRATIONS, SAVE_FORMAT } from "./saveFile";
export type { DecodeOptions, DecodeResult, Migration, Migrations, SaveErrorCode, SaveFile } from "./saveFile";
export { AUTOSAVE, IndexedDbBackend, MAX_CHECKPOINTS, MemoryBackend, SaveSlots } from "./slots";
export type { CheckpointInfo, LoadResult, QuarantineEntry, SaveBackend } from "./slots";
