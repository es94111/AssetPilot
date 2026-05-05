"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TransactionActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-blue-500">編輯</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯交易 {id}</DialogTitle>
        </DialogHeader>
        {/* TODO: Add Edit form */}
        <button onClick={() => setOpen(false)}>儲存</button>
      </DialogContent>
    </Dialog>
  );
}
