/**
 * Version — single source of truth is package.json `version` (SemVer).
 */

import pkg from "../../package.json";

export const APP_NAME = "the LEDGE";

/** @type {string} */
export const APP_VERSION = String(pkg.version || "0.0.0");

export function formatAppVersion(ver = APP_VERSION) {
  const v = String(ver || "0.0.0").replace(/^v/i, "");
  return "v" + v;
}

export function appTitle(ver = APP_VERSION) {
  return `${APP_NAME} ${formatAppVersion(ver)}`;
}
