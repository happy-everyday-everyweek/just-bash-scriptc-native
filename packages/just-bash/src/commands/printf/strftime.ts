import { parseIntDecimal } from "../../utils/num-parse.js";
/**
 * Strftime Formatting Functions
 *
 * Handles date/time formatting for printf's %(...)T directive.
 */

import { ExecutionLimitError } from "../../interpreter/errors.js";
import { utf8ByteLength } from "./escapes.js";

interface StrftimeLimits {
  maxOperations?: number;
  maxOutputBytes?: number;
}

/**
 * Format a timestamp using strftime-like format string.
 */
export function formatStrftime(
  format: string,
  timestamp: number,
  tz?: string,
  limits: StrftimeLimits = {},
): string {
  const date = new Date(timestamp * 1000);
  const parts = getDatePartsInTimezone(date, tz);

  // Build result by replacing format directives
  let result = "";
  let resultBytes = 0;
  let i = 0;
  let operations = 0;
  const directiveCache = new Map<string, string | null>();

  const append = (value: string): void => {
    const valueBytes = utf8ByteLength(value);
    if (
      limits.maxOutputBytes !== undefined &&
      valueBytes > limits.maxOutputBytes - resultBytes
    ) {
      throw new ExecutionLimitError(
        `strftime: output size limit exceeded (${limits.maxOutputBytes} bytes)`,
        "output_size",
      );
    }
    result += value;
    resultBytes += valueBytes;
  };

  while (i < format.length) {
    operations++;
    if (
      limits.maxOperations !== undefined &&
      operations > limits.maxOperations
    ) {
      throw new ExecutionLimitError(
        `strftime: iteration limit exceeded (${limits.maxOperations})`,
        "iterations",
      );
    }
    if (format.charAt(i) === "%" && i + 1 < format.length) {
      const directive = format.charAt(i + 1);
      let formatted: string | null;
      if (directiveCache.has(directive)) {
        formatted = directiveCache.get(directive) ?? null;
      } else {
        formatted = formatStrftimeDirective(date, parts, directive, tz);
        directiveCache.set(directive, formatted);
      }
      if (formatted !== null) {
        append(formatted);
        i += 2;
      } else {
        // Unknown directive, keep as-is
        append(format.charAt(i));
        i++;
      }
    } else {
      append(format.charAt(i));
      i++;
    }
  }

  return result;
}

/**
 * Get date/time parts in a specific timezone using Intl.DateTimeFormat.
 * Returns an object with year, month, day, hour, minute, second, weekday.
 */
function getDatePartsInTimezone(
  date: Date,
  tz?: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
} {
  // Named-timezone rendering needs `Intl.DateTimeFormat`, which has no
  // static lowering; the compiled build renders in the host's local time.
  void tz;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    weekday: date.getDay(),
  };
}

/**
 * Format a single strftime directive.
 */
function formatStrftimeDirective(
  date: Date,
  parts: ReturnType<typeof getDatePartsInTimezone>,
  directive: string,
  tz?: string,
): string | null {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

  const dayOfYear = getDayOfYearForParts(parts.year, parts.month, parts.day);
  const weekNumber = getWeekNumberForParts(
    parts.year,
    parts.month,
    parts.day,
    parts.weekday,
    0,
  ); // Sunday start
  const weekNumberMon = getWeekNumberForParts(
    parts.year,
    parts.month,
    parts.day,
    parts.weekday,
    1,
  ); // Monday start

  switch (directive) {
    case "a":
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parts.weekday];
    case "A":
      return [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][parts.weekday];
    case "b":
    case "h":
      return [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][parts.month - 1];
    case "B":
      return [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][parts.month - 1];
    case "c":
      return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parts.weekday]} ${
        [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][parts.month - 1]
      } ${String(parts.day).padStart(2, " ")} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)} ${parts.year}`;
    case "C":
      return pad(Math.floor(parts.year / 100));
    case "d":
      return pad(parts.day);
    case "D":
      return `${pad(parts.month)}/${pad(parts.day)}/${pad(parts.year % 100)}`;
    case "e":
      return String(parts.day).padStart(2, " ");
    case "F":
      return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    case "g":
      return pad(getISOWeekYear(parts.year, parts.month, parts.day) % 100);
    case "G":
      return String(getISOWeekYear(parts.year, parts.month, parts.day));
    case "H":
      return pad(parts.hour);
    case "I":
      return pad(parts.hour % 12 || 12);
    case "j":
      return String(dayOfYear).padStart(3, "0");
    case "k":
      return String(parts.hour).padStart(2, " ");
    case "l":
      return String(parts.hour % 12 || 12).padStart(2, " ");
    case "m":
      return pad(parts.month);
    case "M":
      return pad(parts.minute);
    case "n":
      return "\n";
    case "N":
      // Nanoseconds - we don't have sub-second precision
      return "000000000";
    case "p":
      return parts.hour < 12 ? "AM" : "PM";
    case "P":
      return parts.hour < 12 ? "am" : "pm";
    case "r":
      return `${pad(parts.hour % 12 || 12)}:${pad(parts.minute)}:${pad(parts.second)} ${parts.hour < 12 ? "AM" : "PM"}`;
    case "R":
      return `${pad(parts.hour)}:${pad(parts.minute)}`;
    case "s":
      return String(Math.floor(date.getTime() / 1000));
    case "S":
      return pad(parts.second);
    case "t":
      return "\t";
    case "T":
      return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
    case "u":
      return String(parts.weekday === 0 ? 7 : parts.weekday);
    case "U":
      return pad(weekNumber);
    case "V":
      return pad(getISOWeekNumberForParts(parts.year, parts.month, parts.day));
    case "w":
      return String(parts.weekday);
    case "W":
      return pad(weekNumberMon);
    case "x":
      return `${pad(parts.month)}/${pad(parts.day)}/${pad(parts.year % 100)}`;
    case "X":
      return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
    case "y":
      return pad(parts.year % 100);
    case "Y":
      return String(parts.year);
    case "z":
      return getTimezoneOffset(date, tz);
    case "Z":
      return getTimezoneName(date, tz);
    case "%":
      return "%";
    default:
      return null;
  }
}

/**
 * Get the timezone offset in +/-HHMM format.
 */
function getTimezoneOffset(date: Date, tz?: string): string {
  if (!tz) {
    // Use local timezone
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 60);
    const mins = Math.abs(offset) % 60;
    return `${sign}${String(hours).padStart(2, "0")}${String(mins).padStart(2, "0")}`;
  }

  // Named-timezone offsets need `Intl.DateTimeFormat`; the compiled build
  // falls back to the host's local offset below.
  void tz;

  // Fallback to local timezone offset
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60);
  const mins = Math.abs(offset) % 60;
  return `${sign}${String(hours).padStart(2, "0")}${String(mins).padStart(2, "0")}`;
}

/**
 * Get the timezone name abbreviation.
 */
function getTimezoneName(date: Date, tz?: string): string {
  // `Intl.DateTimeFormat` has no static lowering; render the local offset.
  void tz;
  const offset = -date.getTimezoneOffset();
  if (offset === 0) return "UTC";
  const sign = offset > 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `GMT${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Calculate day of year (1-366) from date parts.
 */
function getDayOfYearForParts(
  year: number,
  month: number,
  day: number,
): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (isLeap) daysInMonth[1] = 29;

  let dayOfYear = day;
  for (let i = 0; i < month - 1; i++) {
    dayOfYear += daysInMonth[i];
  }
  return dayOfYear;
}

/**
 * Calculate week number from date parts.
 * startDay: 0 = Sunday (%U), 1 = Monday (%W)
 * Days before the first occurrence of startDay are week 00.
 */
/** Days since 1970-01-01 for a proleptic Gregorian date (Hinnant). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Calendar date for a day number (Hinnant). */
function civilFromDays(dayNumber: number): {
  year: number;
  month: number;
  day: number;
} {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) /
      365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: month <= 2 ? y + 1 : y, month, day };
}

/** Weekday (0 = Sunday) for a calendar date, host timezone independent. */
function weekdayOf(year: number, month: number, day: number): number {
  const wd = (daysFromCivil(year, month, day) + 4) % 7;
  return wd < 0 ? wd + 7 : wd;
}

function getWeekNumberForParts(
  year: number,
  month: number,
  day: number,
  _weekday: number,
  startDay: number,
): number {
  const doy = getDayOfYearForParts(year, month, day);
  const jan1dow = weekdayOf(year, 1, 1); // 0=Sun
  // Day-of-year (1-based) of the first startDay on or after Jan 1
  const firstWeekStart = 1 + ((7 + startDay - jan1dow) % 7);
  const days = doy - firstWeekStart;
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

/**
 * Calculate ISO week number (1-53).
 */
function getISOWeekNumberForParts(
  year: number,
  month: number,
  day: number,
): number {
  const dayNumber = daysFromCivil(year, month, day);
  const thursday = dayNumber + 3 - ((weekdayOf(year, month, day) + 6) % 7);
  const thursdayParts = civilFromDays(thursday);
  const jan4 = daysFromCivil(thursdayParts.year, 1, 4);
  const jan4dow = (jan4 + 4) % 7 < 0 ? ((jan4 + 4) % 7) + 7 : (jan4 + 4) % 7;
  const firstThursday = jan4 + 3 - ((jan4dow + 6) % 7);
  return 1 + Math.round((thursday - firstThursday) / 7);
}

/**
 * Get the ISO week year (may differ from calendar year at year boundaries).
 */
function getISOWeekYear(year: number, month: number, day: number): number {
  const dayNumber = daysFromCivil(year, month, day);
  const thursday = dayNumber + 3 - ((weekdayOf(year, month, day) + 6) % 7);
  return civilFromDays(thursday).year;
}
