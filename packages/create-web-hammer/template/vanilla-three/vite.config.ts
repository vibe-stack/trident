import { defineConfig, searchForWorkspaceRoot } from "vite";
import { createWebHammerGamePlugin } from "@ggez/game-dev";

export default defineConfig({
  plugins: [createWebHammerGamePlugin({ initialSceneId: "main", projectName: "__PROJECT_NAME__" })],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())]
    }
  }
});
