// Same scene, but the whole @babylonjs/core package is imported, to compare bundle size with deep imports.
import "@babylonjs/core";
import { runSpike } from "../harness";

runSpike();
