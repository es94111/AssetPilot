'use client';

import React from 'react';

type BadgeProps = {
  variant?: 'income' | 'expense' | 'net' | 'default';
  children: React.ReactNode;
  className?: string;
};

const variantClasses = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  net: 'bg-net/10 text-net',
  default: 'bg-gray-100 text-gray-800',
};

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
