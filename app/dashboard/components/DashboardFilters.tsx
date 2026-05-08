"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";

const filterSchema = z.object({
  month: z.string().optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

export function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      month: searchParams.get("month") || "",
    },
  });

  function onSubmit(values: FilterValues) {
    const params = new URLSearchParams(searchParams);
    if (values.month) {
      params.set("month", values.month);
    } else {
      params.delete("month");
    }
    const query = params.toString();
    router.push(query ? `/dashboard?${query}` : '/dashboard');
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mb-8 flex gap-3 items-center">
      <input
        {...form.register("month")}
        placeholder="選擇月份 (YYYY-MM)"
        className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs"
      />
      <button 
        type="submit" 
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        篩選
      </button>
    </form>
  );
}
