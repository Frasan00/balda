import type { Command } from "./commands/base_command";

/**
 * Calculates Levenshtein distance between two strings for fuzzy matching
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Distance between the strings
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  return matrix[str2.length][str1.length];
};

export const toLowerSnakeCase = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[-_.]/g, "_")
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
    .toLowerCase();
};

export const toPascalCase = (input: string): string => {
  return input
    .split(/[-_.]/g)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

export const toDashCase = (str: string): string => {
  return str
    .split(/[-_.]/g)
    .map((word) => word.toLowerCase())
    .join("-");
};

/**
 * Groups commands by their category
 * @param commands - Array of command classes
 * @returns Map of category to command arrays
 */
export const groupCommandsByCategory = (
  commands: (typeof Command)[],
): Map<string, (typeof Command)[]> => {
  const map = new Map<string, (typeof Command)[]>();

  for (const command of commands) {
    const category = command.options?.category || "other";
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category)!.push(command);
  }

  return map;
};

/**
 * Parses a size limit string and converts it to bytes.
 * Supports formats like "100kb", "50mb".
 * @param sizeLimit - The size limit string (e.g., "5mb", "100kb")
 * @param defaultValue - The default value to return if parsing fails or no value provided
 * @returns The size in bytes, or the default value if parsing fails
 */
export const parseSizeLimit = (
  sizeLimit?: string,
  defaultValue?: number,
): number | undefined => {
  if (!sizeLimit || typeof sizeLimit !== "string") {
    return defaultValue;
  }

  const trimmed = sizeLimit.toLowerCase().trim();
  const kbMatch = trimmed.match(/^(\d+(?:\.\d+)?)kb$/);
  const mbMatch = trimmed.match(/^(\d+(?:\.\d+)?)mb$/);

  if (kbMatch) {
    const value = Number.parseFloat(kbMatch[1]);
    if (Number.isNaN(value) || value < 0) {
      return defaultValue;
    }
    return Math.floor(value * 1024);
  }

  if (mbMatch) {
    const value = Number.parseFloat(mbMatch[1]);
    if (Number.isNaN(value) || value < 0) {
      return defaultValue;
    }
    return Math.floor(value * 1024 * 1024);
  }

  return defaultValue;
};
