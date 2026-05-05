"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";

const filterSchema = z.object({
  account: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

export function FilterControls() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      account: searchParams.get("account") || "",
      category: searchParams.get("category") || "",
      date: searchParams.get("date") || "",
    },
  });

  function onSubmit(values: FilterValues) {
    const params = new URLSearchParams(searchParams);
    if (values.account) params.set("account", values.account); else params.delete("account");
    if (values.category) params.set("category", values.category); else params.delete("category");
    if (values.date) params.set("date", values.date); else params.delete("date");
    router.push(`/app/finance/transactions?${params.toString()}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mb-6 flex gap-4">
      <input {...form.register("account")} placeholder="帳戶" className="p-2 border rounded" />
      <input {...form.register("category")} placeholder="分類" className="p-2 border rounded" />
      <input {...form.register("date")} type="date" className="p-2 border rounded" />
      <button type="submit" className="p-2 bg-slate-900 text-white rounded">篩選</button>
    </form>
  );
}
