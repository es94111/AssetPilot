'use client';

import { useState } from 'react';

/**
 * @param {{ title: string, onMenuClick: () => void }} props
 */
export default function TopNav({ title, onMenuClick }) {
  return (
    <header className="mobile-header">
      <button className="menu-btn" onClick={onMenuClick} aria-label="開啟選單">
        <i className="fas fa-bars" />
      </button>
      <h1 className="mobile-title">{title}</h1>
    </header>
  );
}
