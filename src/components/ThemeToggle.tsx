import React from 'react';
import { useTheme } from '../providers';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <span className="theme-icon moon" role="img" aria-label="Moon">
          🌙
        </span>
      ) : (
        <span className="theme-icon sun" role="img" aria-label="Sun">
          ☀️
        </span>
      )}
    </button>
  );
};
