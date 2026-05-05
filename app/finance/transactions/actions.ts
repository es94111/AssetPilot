"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import logger from "@/lib/logger";
import { requireAuth } from "@/lib/auth";

const transactionSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  category: z.string(),
});

export async function editTransaction(data: z.infer<typeof transactionSchema>) {
  const session = await requireAuth();
  const validated = transactionSchema.parse(data);
  
  logger.info({ id: validated.id }, "Updating transaction");

  const res = await fetch(`http://assetpilot:3000/api/transactions/${validated.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${session}`,
    },
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    logger.error({ id: validated.id, status: res.status }, "Failed to update transaction");
    throw new Error("Failed to update transaction");
  }

  revalidatePath("/app/finance/transactions");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await requireAuth();
  
  logger.info({ id }, "Deleting transaction");

  const res = await fetch(`http://assetpilot:3000/api/transactions/${id}`, {
    method: 'DELETE',
    headers: {
      'Cookie': `session=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ id, status: res.status }, "Failed to delete transaction");
    throw new Error("Failed to delete transaction");
  }

  revalidatePath("/app/finance/transactions");
  return { success: true };
}
