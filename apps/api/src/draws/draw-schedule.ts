/**
 * Works out when a draw runs once a session fills up: the next occurrence of
 * the session's local draw time (e.g. 18:00 Africa/Casablanca) that is
 * strictly after the moment the target was reached.
 */
export function nextDrawTime(filledAt: Date, timeOfDay: string, timeZone: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeOfDay);
  if (!match) throw new Error(`Invalid draw time "${timeOfDay}", expected HH:mm`);
  const [hours, minutes] = [Number(match[1]), Number(match[2])];

  const local = localParts(filledAt, timeZone);
  for (let addDays = 0; addDays <= 2; addDays++) {
    const candidate = zonedTimeToUtc(local.year, local.month, local.day + addDays, hours, minutes, timeZone);
    if (candidate.getTime() > filledAt.getTime()) return candidate;
  }
  throw new Error('Could not compute next draw time');
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Converts a wall-clock time in `timeZone` to a UTC Date (handles DST changes). */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = asUtc;
  // Two passes settle the offset even across a DST boundary.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
    guess = asUtc - offset;
  }
  return new Date(guess);
}

/** When a session's draw runs: a fixed delay after it filled if one is set, else the next draw time of day. */
export function drawTimeFor(session: {
  filledAt: Date | null;
  drawTimeOfDay: string;
  timezone: string;
  drawDelayMinutes: number | null;
}): Date {
  if (!session.filledAt) throw new Error('Session has not filled yet');
  if (session.drawDelayMinutes) return new Date(session.filledAt.getTime() + session.drawDelayMinutes * 60_000);
  return nextDrawTime(session.filledAt, session.drawTimeOfDay, session.timezone);
}
