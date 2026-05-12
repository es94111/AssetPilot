"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import logger from "@/lib/logger";
import { requireAuth } from "@/lib/auth";

const transactionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/, "Invalid transaction id"),
  amount: z.number().positive(),
  category: z.string(),
});

const transactionIdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, "Invalid transaction id");

function transactionApiUrl(id: string) {
  return `http://assetpilot:3000/api/transactions/${encodeURIComponent(id)}`;
}

export async function editTransaction(data: z.infer<typeof transactionSchema>) {
  const session = await requireAuth();
  const validated = transactionSchema.parse(data);
  
  logger.info({ id: validated.id }, "Updating transaction");

  const res = await fetch(transactionApiUrl(validated.id), {
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

  revalidatePath("/finance/transactions");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await requireAuth();
  const validatedId = transactionIdSchema.parse(id);
  
  logger.info({ id: validatedId }, "Deleting transaction");

  const res = await fetch(transactionApiUrl(validatedId), {
    method: 'DELETE',
    headers: {
      'Cookie': `session=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ id: validatedId, status: res.status }, "Failed to delete transaction");
    throw new Error("Failed to delete transaction");
  }

  revalidatePath("/finance/transactions");
  return { success: true };
}
