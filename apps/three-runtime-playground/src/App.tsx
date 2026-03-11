import { useEffect, useMemo, useRef, useState } from "react";
import {
  createWebHammerBundleAssetResolver,
  parseWebHammerEngineBundleZip,
  parseWebHammerEngineScene,
  type WebHammerEngineScene
} from "@web-hammer/three-runtime";
import { normalizeSceneSettings, type PlayerCameraMode } from "@web-hammer/shared";
import { createPlaybackRenderScene } from "./adapter";
import { PlaybackScene } from "./PlaybackScene";
import { createSampleScene, resolveSampleAssetPath } from "./sample-scene";

export function App() {
  const [scene, setScene] = useState<WebHammerEngineScene>(createSampleScene());
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string>();
  const [physicsPlayback, setPhysicsPlayback] = useState<"paused" | "running" | "stopped">("stopped");
  const [physicsRevision, setPhysicsRevision] = useState(0);
  const [cameraMode, setCameraMode] = useState<PlayerCameraMode>("third-person");
  const [resolveAssetPath, setResolveAssetPath] = useState<(path: string) => Promise<string> | string>(() => resolveSampleAssetPath);
  const bundleResolverRef = useRef<ReturnType<typeof createWebHammerBundleAssetResolver> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedSceneSettings = useMemo(() => normalizeSceneSettings(scene.settings), [scene.settings]);

  const renderScene = useMemo(() => createPlaybackRenderScene(scene), [scene]);

  useEffect(() => {
    setCameraMode(normalizedSceneSettings.player.cameraMode);
  }, [normalizedSceneSettings.player.cameraMode]);

  useEffect(() => {
    return () => {
      bundleResolverRef.current?.dispose();
    };
  }, []);

  const loadSample = () => {
    bundleResolverRef.current?.dispose();
    bundleResolverRef.current = undefined;
    setScene(createSampleScene());
    setResolveAssetPath(() => resolveSampleAssetPath);
    setPhysicsPlayback("stopped");
    setPhysicsRevision((current) => current + 1);
    setError(undefined);
    setStatus("Sample scene loaded");
  };

  const importFile = async (file: File) => {
    setError(undefined);
    setStatus(`Importing ${file.name}`);

    try {
      let nextScene: WebHammerEngineScene;
      let nextResolver: (path: string) => Promise<string> | string = resolveSampleAssetPath;

      if (file.name.toLowerCase().endsWith(".zip")) {
        const zipBytes = new Uint8Array(await file.arrayBuffer());
        const bundle = parseWebHammerEngineBundleZip(zipBytes);
        bundleResolverRef.current?.dispose();
        const bundleResolver = createWebHammerBundleAssetResolver(bundle);
        bundleResolverRef.current = bundleResolver;
        nextScene = bundle.manifest;
        nextResolver = (path: string) => bundleResolver.resolve(path);
      } else {
        const text = await file.text();
        bundleResolverRef.current?.dispose();
        bundleResolverRef.current = undefined;
        nextScene = parseWebHammerEngineScene(text);
      }

      setScene(nextScene);
      setResolveAssetPath(() => nextResolver);
      setPhysicsPlayback("stopped");
      setPhysicsRevision((current) => current + 1);
      setStatus(`${file.name}: ${createPlaybackRenderScene(nextScene).meshes.length} meshes`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to import runtime bundle.");
      setStatus("Import failed");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Web Hammer Runtime Playground</div>
        <div className="toolbar">
          <button onClick={loadSample} type="button">Sample</button>
          <button onClick={() => fileInputRef.current?.click()} type="button">Import Bundle</button>
          <input
            accept=".zip,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void importFile(file);
              }

              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <select aria-label="Camera mode" onChange={(event) => setCameraMode(event.target.value as PlayerCameraMode)} value={cameraMode}>
            <option value="third-person">Third Person</option>
            <option value="fps">FPS</option>
            <option value="top-down">Top Down</option>
          </select>
          <button className={physicsPlayback === "running" ? "active" : undefined} onClick={() => setPhysicsPlayback("running")} type="button">Play</button>
          <button className={physicsPlayback === "paused" ? "active" : undefined} onClick={() => setPhysicsPlayback("paused")} type="button">Pause</button>
          <button
            className={physicsPlayback === "stopped" ? "active" : undefined}
            onClick={() => {
              setPhysicsPlayback("stopped");
              setPhysicsRevision((current) => current + 1);
            }}
            type="button"
          >
            Stop
          </button>
        </div>
        <div className="status">{status}</div>
      </header>

      <main id="stage">
        <PlaybackScene
          cameraMode={cameraMode}
          physicsRevision={physicsRevision}
          physicsPlayback={physicsPlayback}
          renderScene={renderScene}
          resolveAssetPath={resolveAssetPath}
          sceneSettings={normalizedSceneSettings}
        />
      </main>

      <div className={`error-banner${error ? "" : " hidden"}`}>{error}</div>
    </div>
  );
}
