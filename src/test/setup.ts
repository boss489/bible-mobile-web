import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn((xOrOpts?: number | ScrollToOptions, y?: number) => {
    if (typeof xOrOpts === 'number' && typeof y === 'number') {
      Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
    }
  }),
});
