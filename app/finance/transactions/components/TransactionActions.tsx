"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TransactionActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 阻止觸發器事件冒泡到 TableRow */}
      <DialogTrigger 
        className="text-blue-500 hover:text-blue-700 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        編輯
      </DialogTrigger>
      
      {/* 點擊內容內部時防止冒泡並阻止預設行為 */}
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>編輯交易 {id}</DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          {/* TODO: Add Edit form */}
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setOpen(false)}
          >
            儲存
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
