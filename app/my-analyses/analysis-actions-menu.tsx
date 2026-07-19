"use client";

import { useState } from "react";
import { useMessages } from "../use-messages";
import { OverflowMenu, type OverflowMenuItem } from "./overflow-menu";
import { RenameAnalysisDialog } from "./rename-analysis-dialog";
import { DeleteAnalysisDialog } from "./delete-analysis-dialog";

// The per-row composition: owns which dialog is currently open and wires
// each into the generic, reusable OverflowMenu primitive. Open stays its
// own always-visible button (app/my-analyses/page.tsx); Rename and Delete
// both live in this menu.
//
// `items` is the stable extension point for future actions (Duplicate,
// Share, Export, ...): each one is added the same way Delete was — a new
// entry here backed by its own controlled dialog, conditionally mounted
// below — with no restructuring of this component and no changes to
// OverflowMenu itself.
export function AnalysisActionsMenu({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const messages = useMessages();
  const actionsMenu = messages.myAnalyses.actionsMenu;
  const renameMessages = messages.myAnalyses.rename;
  const deleteMessages = messages.myAnalyses.delete;

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const items: OverflowMenuItem[] = [
    {
      key: "rename",
      label: renameMessages.triggerLabel,
      onSelect: () => setIsRenameDialogOpen(true),
    },
    {
      key: "delete",
      label: deleteMessages.triggerLabel,
      variant: "destructive",
      onSelect: () => setIsDeleteDialogOpen(true),
    },
  ];

  return (
    <>
      <OverflowMenu
        triggerLabel={`${actionsMenu.triggerLabel}: ${title}`}
        items={items}
      />
      {isRenameDialogOpen && (
        <RenameAnalysisDialog
          id={id}
          title={title}
          onClose={() => setIsRenameDialogOpen(false)}
        />
      )}
      {isDeleteDialogOpen && (
        <DeleteAnalysisDialog
          id={id}
          title={title}
          onClose={() => setIsDeleteDialogOpen(false)}
        />
      )}
    </>
  );
}
