import { PlaybackScene } from "./PlaybackScene";
import { RuntimePlaygroundShell } from "./playground/RuntimePlaygroundShell";
import { useRuntimePlayground } from "./playground/useRuntimePlayground";

export function App() {
  const playground = useRuntimePlayground();

  return (
    <RuntimePlaygroundShell
      controls={playground.controls}
      error={playground.error}
      panel={playground.panel}
      stage={
        <PlaybackScene
          cameraMode={playground.sceneSettings.player.cameraMode}
          gameplayRuntime={playground.gameplayRuntime}
          onNodeObjectChange={playground.host.bindNodeObject}
          onNodePhysicsBodyChange={playground.host.bindNodePhysicsBody}
          onPlayerActorChange={playground.handlePlayerActorChange}
          physicsRevision={playground.physicsRevision}
          physicsPlayback={playground.physicsPlayback}
          renderScene={playground.renderScene}
          resolveAssetPath={playground.resolveAssetPath}
          sceneSettings={playground.sceneSettings}
        />
      }
      stageStats={playground.stageStats}
      status={playground.status}
    />
  );
}
