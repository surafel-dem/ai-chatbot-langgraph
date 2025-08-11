export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const guestRegex = /^guest-\d+$/;

export const ANONYMOUS_SESSION_COOKIES_KEY = 'anonymous-session';

// Anonymous limits (read-only wiring for now)
export const ANONYMOUS_LIMITS = {
  CREDITS: process.env.NODE_ENV === 'production' ? 10 : 1000,
  SESSION_DURATION: 60 * 60 * 24, // seconds
} as const;
