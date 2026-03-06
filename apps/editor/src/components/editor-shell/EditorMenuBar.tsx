import { BookOpen, FileText, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger
} from "@/components/ui/menubar";
import { TridentIcon } from "@/components/editor-shell/icons";

type EditorMenuBarProps = {
  canRedo: boolean;
  canUndo: boolean;
  onClearSelection: () => void;
  onDuplicateSelection: () => void;
  onExportEngine: () => void;
  onExportGltf: () => void;
  onFocusSelection: () => void;
  onLoadWhmap: () => void;
  onRedo: () => void;
  onSaveWhmap: () => void;
  onUndo: () => void;
};

export function EditorMenuBar({
  canRedo,
  canUndo,
  onClearSelection,
  onDuplicateSelection,
  onExportEngine,
  onExportGltf,
  onFocusSelection,
  onLoadWhmap,
  onRedo,
  onSaveWhmap,
  onUndo
}: EditorMenuBarProps) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 px-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center gap-2 px-2 text-[11px] font-medium tracking-[0.22em] text-foreground/92 uppercase">
          <TridentIcon className="size-3.5 text-emerald-400" />
          <span>Trident</span>
        </div>

        <Menubar className="h-7 rounded-xl bg-transparent p-0 text-[11px] shadow-none">
          <MenubarMenu>
            <MenubarTrigger className="h-7 rounded-lg px-2.5 text-[11px] text-foreground/70 hover:bg-white/5 hover:text-foreground">
              File
            </MenubarTrigger>
            <MenubarContent className="min-w-44 rounded-xl bg-popover/96 p-1.5 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
              <MenubarItem className="rounded-lg text-xs" onClick={onSaveWhmap}>
                Save `.whmap`
                <MenubarShortcut>Cmd+S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onLoadWhmap}>
                Load `.whmap`
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onExportGltf}>
                Export glTF
              </MenubarItem>
              <MenubarItem className="rounded-lg text-xs" onClick={onExportEngine}>
                Export Engine
              </MenubarItem>
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
      </div>

      <div className="flex items-center gap-1">
        <Button className="text-[11px] text-foreground/65" size="icon-xs" variant="ghost">
          <FileText className="size-3.5" />
        </Button>
        <Button className="text-[11px] text-foreground/65" size="icon-xs" variant="ghost">
          <Pencil className="size-3.5" />
        </Button>
        <Button className="text-[11px] text-foreground/65" size="icon-xs" variant="ghost">
          <Sparkles className="size-3.5" />
        </Button>
        <Button className="text-[11px] text-foreground/65" size="icon-xs" variant="ghost">
          <BookOpen className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
