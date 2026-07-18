"use client";

import { useState } from "react";
import { useMessages } from "../use-messages";
import { OverflowMenu } from "./overflow-menu";
import { RenameAnalysisDialog } from "./rename-analysis-dialog";

// The per-row composition: owns which dialog is currently open and wires
// it into the generic, reusable OverflowMenu primitive. Open and Delete
// stay as their own separate, always-visible buttons
// (app/my-analyses/page.tsx) — only Rename lives in this menu for now.
//
// Deliberately the only seam that will need to change when Delete moves
// into this menu in a later task: `items` below gains one more entry
// (backed by its own controlled confirmation dialog, mirroring
// RenameAnalysisDialog's shape), and page.tsx's standalone
// DeleteAnalysisButton call is removed. OverflowMenu and
// RenameAnalysisDialog themselves need no changes at all.
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

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  return (
    <>
      <OverflowMenu
        triggerLabel={`${actionsMenu.triggerLabel}: ${title}`}
        items={[
          {
            key: "rename",
            label: renameMessages.triggerLabel,
            onSelect: () => setIsRenameDialogOpen(true),
          },
        ]}
      />
      {isRenameDialogOpen && (
        <RenameAnalysisDialog
          id={id}
          title={title}
          onClose={() => setIsRenameDialogOpen(false)}
        />
      )}
    </>
  );
}
