"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionActions } from "./TransactionActions";

interface Transaction {
  id: string;
  date: string;
  account: string;
  category: string;
  amount: number;
}

export function TransactionsTable({ data }: { data: Transaction[] }) {
  return (
    <div className="rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">日期</TableHead>
            <TableHead className="font-semibold text-slate-700">帳戶</TableHead>
            <TableHead className="font-semibold text-slate-700">分類</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right">金額</TableHead>
            <TableHead className="font-semibold text-slate-700 text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((tx) => (
            <TableRow key={tx.id} className="hover:bg-slate-50 transition-colors">
              <TableCell className="text-slate-600">{tx.date}</TableCell>
              <TableCell className="font-medium">{tx.account}</TableCell>
              <TableCell>
                <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {tx.category}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {tx.amount.toLocaleString()}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-2">
                  <TransactionActions id={tx.id} />
                  <button className="text-slate-400 hover:text-red-600 transition-colors">刪除</button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
