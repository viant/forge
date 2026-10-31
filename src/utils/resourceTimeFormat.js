// A finite tagly/Go layout presentation subset. This module formats instants;
// it deliberately does not interpret local wall-clock input as an instant.
const layouts = new Set(['2006-01-02', '2006-01-02 15:04', '2006-01-02 15:04:05', '2006-01-02T15:04:05Z07:00']);
export function formatResourceTime(value, metadata = {}) {
 const layout = metadata.timeLayout || '2006-01-02T15:04:05Z07:00';
 if (!layouts.has(layout)) throw new Error(`Unsupported time layout: ${layout}`);
 if (value == null) return metadata.nullable ? 'null' : '';
 if (metadata.omitEmpty && value === '') return '';
 // Require an explicit instant to avoid browser-local/DST parsing assumptions.
 if (!(value instanceof Date) && typeof value !== 'number' && !(typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value))) throw new Error('Time formatting requires an explicit instant; wall-clock parsing needs an explicit caller policy.');
 if (typeof value === 'string' && /\.\d{4,}/.test(value)) throw new Error('Sub-millisecond time precision requires an explicit formatting hook.');
 const date = value instanceof Date ? value : new Date(value);
 if (!Number.isFinite(date.getTime())) throw new Error('Invalid time instant.');
 if (date.getUTCFullYear() < 100 || date.getUTCFullYear() > 9999) throw new Error('Unsupported time year outside 0100 through 9999.');
 const zone = metadata.timeZone || (typeof value === 'string' ? value.match(/([+-]\d\d:\d\d)$/)?.[1] : '') || 'UTC';
 // Intl accepts IANA zones; fixed offsets use a shifted UTC instant for parity.
 const fixed = /^([+-])(\d\d):(\d\d)$/.exec(zone);
 const minutes = fixed ? (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2])*60+Number(fixed[3])) : 0;
 const displayDate = fixed ? new Date(date.getTime()+minutes*60000) : date;
 const timeZone = fixed ? 'UTC' : zone === 'utc' ? 'UTC' : zone;
 const formatter = new Intl.DateTimeFormat('en-US', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts = Object.fromEntries(formatter.formatToParts(displayDate).map(part=>[part.type,part.value]));
 const day = `${parts.year}-${parts.month}-${parts.day}`, clock=`${parts.hour}:${parts.minute}`;
 if (layout === '2006-01-02') return day;
 if (layout === '2006-01-02 15:04') return `${day} ${clock}`;
 if (layout === '2006-01-02 15:04:05') return `${day} ${clock}:${parts.second}`;
 const wall = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
 const exactOffset = (wall-Math.floor(date.getTime()/1000)*1000)/60000;
 if (!fixed && !Number.isInteger(exactOffset)) throw new Error('Sub-minute historical timezone offsets require an explicit formatting hook.');
 const offset = fixed ? minutes : exactOffset;
 const suffix = offset===0 ? 'Z' : `${offset<0?'-':'+'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')}`;
 return `${day}T${clock}:${parts.second}${suffix}`;
}
