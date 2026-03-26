import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(8, '密碼至少 8 個字元'),
  name: z.string().min(1, '姓名為必填'),
});

export const loginSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(1, '密碼為必填'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
