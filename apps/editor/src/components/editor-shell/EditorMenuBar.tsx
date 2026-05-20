import { Bot, Cable, FolderOpen, Gauge, PanelLeft, SquareTerminal, Film, Play, Hammer, Package } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarShortcut,
  MenubarTrigger
} from "@/components/ui/menubar";
import { TridentIcon } from "@/components/editor-shell/icons";
import type { ViewportQuality } from "@/state/ui-store";
import { dispatchTerminalCommand } from "@/state/ui-store";

type EditorMenuBarProps = {
  canRedo: boolean;
  canUndo: boolean;
  copilotOpen: boolean;
  fileBrowserOpen?: boolean;
  gameConnectionControl?: ReactNode;
  isElectron?: boolean;
  logicViewerOpen: boolean;
  onClearSelection: () => void;
  onCreateBrush: () => void;
  onCreateProject?: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onGroupSelection: () => void;
  onExportEngine: () => void;
  onExportGltf: () => void;
  onExportSceneDocument: () => void;
  onFocusSelection: () => void;
  onImportSceneDocument: () => void;
  onLoadWhmap: () => void;
  onOpenProject?: () => void;
  onOpenAnimationStudio?: () => void;
  onNewFile: () => void;
  onRedo: () => void;
  onSaveWhmap: () => void;
  onToggleCopilot: () => void;
  onToggleFileBrowser?: () => void;
  onToggleLogicViewer: () => void;
  onToggleTerminal?: () => void;
  terminalOpen?: boolean;
  onToggleViewportQuality: () => void;
  onUndo: () => void;
  projectName?: string | null;
  viewportQuality: ViewportQuality;
};

export function EditorMenuBar({
  canRedo,
  canUndo,
  copilotOpen,
  fileBrowserOpen,
  gameConnectionControl,
  isElectron,
  logicViewerOpen,
  onClearSelection,
  onCreateBrush,
  onCreateProject,
  onDeleteSelection,
  onDuplicateSelection,
  onGroupSelection,
  onExportEngine,
  onExportGltf,
  onExportSceneDocument,
  onFocusSelection,
  onImportSceneDocument,
  onLoadWhmap,
  onOpenProject,
  onOpenAnimationStudio,
  onNewFile,
  onRedo,
  onSaveWhmap,
  onToggleCopilot,
  onToggleFileBrowser,
  onToggleLogicViewer,
  onToggleTerminal,
  terminalOpen,
  onToggleViewportQuality,
  viewportQuality,
  onUndo,
  projectName
}: EditorMenuBarProps) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 px-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center px-2">
          <img src="/icon.svg" alt="Logo" className="w-auto h-10 shrink-0 object-contain object-left" />
        </div>

        <Menubar className="h-7 rounded-xl bg-transparent p-0 text-[11px] shadow-none">
          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              File
            </MenubarTrigger>
            <MenubarContent className="min-w-44 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              {isElectron && (
                <>
                  <MenubarItem className="rounded-lg text-xs" onClick={onOpenProject}>
                    <FolderOpen className="mr-2 size-3.5" />
                    Open Project
                    <MenubarShortcut>Ctrl+O</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem className="rounded-lg text-xs" onClick={onCreateProject}>
                    New Project
                    <MenubarShortcut>Ctrl+N</MenubarShortcut>
                  </MenubarItem>
                  <MenubarSeparator />
                </>
              )}
              <MenubarItem className="rounded-lg text-xs" onClick={onNewFile}>
                New File
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onCreateBrush}>
                New Brush
              </MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger className="rounded-lg text-xs">Import</MenubarSubTrigger>
                <MenubarSubContent className="min-w-44 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
                  <MenubarItem className="rounded-lg text-xs" onClick={onLoadWhmap}>
                    World `.whmap`
                  </MenubarItem>
                  <MenubarItem className="rounded-lg text-xs" onClick={onImportSceneDocument}>
                    Scene `.whdoc`
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub>
                <MenubarSubTrigger className="rounded-lg text-xs">Export</MenubarSubTrigger>
                <MenubarSubContent className="min-w-48 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
                  <MenubarItem className="rounded-lg text-xs" onClick={onSaveWhmap}>
                    World `.whmap`
                    <MenubarShortcut>Cmd+S</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem className="rounded-lg text-xs" onClick={onExportSceneDocument}>
                    Scene `.whdoc`
                  </MenubarItem>
                  <MenubarItem className="rounded-lg text-xs" onClick={onExportGltf}>
                    Export glTF
                  </MenubarItem>
                  <MenubarItem className="rounded-lg text-xs" onClick={onExportEngine}>
                    Export Runtime Bundle
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              Edit
            </MenubarTrigger>
            <MenubarContent className="min-w-44 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              <MenubarItem className="rounded-lg text-xs" disabled={!canUndo} onClick={onUndo}>
                Undo
                <MenubarShortcut>Cmd+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" disabled={!canRedo} onClick={onRedo}>
                Redo
                <MenubarShortcut>Cmd+Shift+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onDuplicateSelection}>
                Duplicate
                <MenubarShortcut>Cmd+D</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onGroupSelection}>
                Group Selection
                <MenubarShortcut>Cmd+G</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onDeleteSelection}>
                Delete
                <MenubarShortcut>Del</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onClearSelection}>
                Clear Selection
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              Render
            </MenubarTrigger>
            <MenubarContent className="min-w-44 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              <MenubarItem className="rounded-lg text-xs" onClick={onFocusSelection}>
                Focus Selection
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              View
            </MenubarTrigger>
            <MenubarContent className="min-w-48 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              <MenubarItem className="rounded-lg text-xs" onClick={onToggleLogicViewer}>
                {logicViewerOpen ? "Hide" : "Show"} Logic Graph
                <MenubarShortcut>Cmd+Shift+L</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onToggleCopilot}>
                {copilotOpen ? "Hide" : "Show"} AI Vibe
                <MenubarShortcut>Cmd+L</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              Help
            </MenubarTrigger>
            <MenubarContent className="min-w-52 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              <MenubarItem className="rounded-lg text-xs">
                Click to select
                <MenubarShortcut>Mouse 1</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs">
                Focus object
                <MenubarShortcut>Double click</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs">
                Marquee select
                <MenubarShortcut>Shift drag</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        {isElectron && (
          <div className="flex items-center gap-1 pl-2 ml-2 border-l border-white/10">
            <Button
              aria-label="Install Dependencies"
              className="size-7 rounded-lg text-foreground/65 hover:text-emerald-300"
              onClick={() => {
                dispatchTerminalCommand("Install", "bun install");
              }}
              title="Install Dependencies"
              size="icon-sm"
              variant="ghost"
            >
              <Package className="size-3.5" />
            </Button>
            <Button
              aria-label="Build Project"
              className="size-7 rounded-lg text-foreground/65 hover:text-emerald-300"
              onClick={() => {
                onSaveWhmap();
                dispatchTerminalCommand("Build", "bun install && bun run build");
              }}
              title="Build Project"
              size="icon-sm"
              variant="ghost"
            >
              <Hammer className="size-3.5" />
            </Button>
            <Button
              aria-label="Play Project"
              className="size-7 rounded-lg text-foreground/65 hover:text-emerald-300"
              onClick={() => {
                onSaveWhmap();
                dispatchTerminalCommand("Server", "bun install && bun run dev --port 3456");
                setTimeout(() => {
                  window.open("http://localhost:3456", "_blank");
                }, 2000);
              }}
              title="Play Project (Launch Dev Server)"
              size="icon-sm"
              variant="ghost"
            >
              <Play className="size-3.5" />
            </Button>
            {onOpenAnimationStudio && (
              <Button
                aria-label="Animation Studio"
                className="size-7 rounded-lg text-foreground/65 hover:text-emerald-300"
                onClick={onOpenAnimationStudio}
                title="Launch Animation Studio"
                size="icon-sm"
                variant="ghost"
              >
                <Film className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 px-2">
        {projectName && (
          <span className="text-[10px] font-medium tracking-wider text-foreground/35 uppercase truncate max-w-32">
            {projectName}
          </span>
        )}
        {isElectron && onToggleFileBrowser && (
          <Button
            aria-label="File Browser"
            className={`size-7 rounded-lg ${fileBrowserOpen ? "text-emerald-400 hover:text-emerald-300" : "text-foreground/65 hover:text-foreground"}`}
            onClick={onToggleFileBrowser}
            title="Toggle File Browser"
            size="icon-sm"
            variant="ghost"
          >
            <PanelLeft className="size-3.5" />
          </Button>
        )}
        {isElectron && onToggleTerminal && (
          <Button
            aria-label="Terminal"
            className={`size-7 rounded-lg ${terminalOpen ? "text-emerald-400 hover:text-emerald-300 bg-white/5" : "text-foreground/65 hover:text-foreground"}`}
            onClick={onToggleTerminal}
            title="Toggle Terminal"
            size="icon-sm"
            variant="ghost"
          >
            <SquareTerminal className="size-3.5" />
          </Button>
        )}
        {gameConnectionControl}
        <Button
          aria-label={`Canvas DPR ${viewportQuality.toFixed(2)}x`}
          className="text-[11px] text-foreground/65 hover:text-foreground flex flex-row gap-1 px-2"
          onClick={onToggleViewportQuality}
          size="icon-xs"
          title={`Canvas DPR ${viewportQuality.toFixed(2)}x`}
          variant="ghost"
        >
          <Gauge className="size-3.5" />
          {viewportQuality.toFixed(2)}
        </Button>
        <Button
          aria-label="Logic Graph"
          className={`size-7 rounded-lg ${logicViewerOpen ? "text-emerald-400 hover:text-emerald-300" : "text-foreground/65 hover:text-foreground"}`}
          onClick={onToggleLogicViewer}
          title="Logic Graph (Cmd+Shift+L)"
          size="icon-sm"
          variant="ghost"
        >
          <Cable className="size-3.5" />
        </Button>
        <Button
          aria-label="AI Vibe"
          className={`size-7 rounded-lg ${copilotOpen ? "text-emerald-400 hover:text-emerald-300" : "text-foreground/65 hover:text-foreground"}`}
          onClick={onToggleCopilot}
          title="AI Vibe (Cmd+L)"
          size="icon-sm"
          variant="ghost"
        >
          <Bot className="size-3.5" />
        </Button>
        {/* Electron Native tools chunk was moved to left menu block */}
      </div>
    </div>
  );
}
