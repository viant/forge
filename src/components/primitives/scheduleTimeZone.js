function partsAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function isValidTimeZone(timeZone) {
  try { new Intl.DateTimeFormat('en-US', {timeZone}).format(new Date(0)); return true; } catch (_) { return false; }
}

export function instantToWallTime(instant, timeZone = 'UTC') {
  if (!instant) return '';
  const part = partsAt(instant, timeZone);
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

function offsetAt(timestamp, timeZone) {
  const part = partsAt(timestamp, timeZone);
  return Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day), Number(part.hour), Number(part.minute), Number(part.second)) - new Date(timestamp).getTime();
}

export function wallTimeToInstant(value, timeZone = 'UTC', ambiguousPolicy = 'reject') {
  if (!value) return '';
  if (!isValidTimeZone(timeZone)) throw new Error(`Invalid time zone: ${timeZone}`);
  const naive = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(naive)) throw new Error('Invalid wall time.');
  const offsets = new Set();
  for (let hour = -18; hour <= 18; hour += 3) offsets.add(offsetAt(naive + hour * 3600000, timeZone));
  const candidates = [...offsets].map((offset) => naive - offset)
    .filter((instant) => instantToWallTime(instant, timeZone) === value)
    .sort((left, right) => left - right);
  const unique = [...new Set(candidates)];
  if (!unique.length) throw new Error(`${value} does not exist in ${timeZone} because of a daylight-saving transition.`);
  if (unique.length > 1 && ambiguousPolicy === 'reject') throw new Error(`${value} occurs twice in ${timeZone}; choose an earlier or later offset policy.`);
  const chosen = ambiguousPolicy === 'later' ? unique[unique.length - 1] : unique[0];
  return new Date(chosen).toISOString();
}

export function applyWallTimeDraft(row, field, value, timeZone, ambiguousPolicy = 'reject') {
  const next = {...row, _scheduleErrors: {...(row._scheduleErrors || {})}, _scheduleDraft: {...(row._scheduleDraft || {})}};
  try {
    next[field] = wallTimeToInstant(value, timeZone, ambiguousPolicy);
    delete next._scheduleErrors[field];
    delete next._scheduleDraft[field];
  } catch (error) {
    next._scheduleErrors[field] = error.message;
    next._scheduleDraft[field] = value;
  }
  return next;
}

export function applyScheduleTimeZone(row, timeZoneField, timeZone, dateFields = [], ambiguousPolicy = 'reject') {
  let next = {...row, [timeZoneField]: timeZone, _scheduleErrors: {...(row._scheduleErrors || {})}, _scheduleDraft: {...(row._scheduleDraft || {})}};
  if (!isValidTimeZone(timeZone)) {
    next._scheduleErrors[timeZoneField] = `Invalid time zone: ${timeZone}`;
    return next;
  }
  delete next._scheduleErrors[timeZoneField];
  for (const field of dateFields) if (next._scheduleDraft[field] != null) next = applyWallTimeDraft(next, field, next._scheduleDraft[field], timeZone, ambiguousPolicy);
  return next;
}
