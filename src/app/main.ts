import { createPlaceholderScene } from "../render/placeholderScene";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing #game canvas");

const { engine, scene } = createPlaceholderScene(canvas);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
