const url = import.meta.env.VITE_INFLUX_URL || '';
const token = import.meta.env.VITE_INFLUX_TOKEN || '';
const org = import.meta.env.VITE_INFLUX_ORG || '';
const bucket = import.meta.env.VITE_INFLUX_BUCKET || '';
const useBasic = (import.meta.env.VITE_INFLUX_BASIC || 'false') === 'true';
const basicUser = import.meta.env.VITE_INFLUX_USER || '';
const basicPass = import.meta.env.VITE_INFLUX_PASSWORD || '';

export const isInfluxConfigured = () => !!(url && org && bucket && (token || (useBasic && basicUser && basicPass)));

const headersWrite = () => ({
  Authorization: useBasic ? `Basic ${btoa(`${basicUser}:${basicPass}`)}` : `Token ${token}`,
  'Content-Type': 'text/plain; charset=utf-8'
});

const headersQuery = () => ({
  Authorization: useBasic ? `Basic ${btoa(`${basicUser}:${basicPass}`)}` : `Token ${token}`,
  'Content-Type': 'application/vnd.flux',
  Accept: 'application/csv'
});

const escTag = (s: string) => String(s).replace(/[,= ]/g, '_');

export type Point = { timestamp: number; value: number };

export async function writeRoomHistory(roomCode: string, points: Point[]) {
  if (!isInfluxConfigured()) return { ok: false, reason: 'not_configured' };
  if (!points?.length) return { ok: true };
  const lines = points
    .map(p => `room_temp,room=${escTag(roomCode)} value=${p.value} ${p.timestamp}`)
    .join('\n');
  const resp = await fetch(
    `${url}/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}&precision=ms`,
    { method: 'POST', headers: headersWrite(), body: lines }
  );
  return { ok: resp.ok, status: resp.status };
}

export async function queryAverageSeries(startMs: number, endMs: number, windowMs: number): Promise<Point[]> {
  if (!isInfluxConfigured()) return [];
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const flux = `from(bucket: "${bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value")
  |> aggregateWindow(every: ${windowMs}ms, fn: mean, createEmpty: false)
  |> group(columns: ["_time"]) 
  |> mean()`;

  const resp = await fetch(`${url}/api/v2/query?org=${encodeURIComponent(org)}`, {
    method: 'POST', headers: headersQuery(), body: flux
  });
  if (!resp.ok) return [];
  const csv = await resp.text();
  const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  const header = lines.find(l => l.includes('_time') && l.includes('_value')) || '';
  const cols = header.split(',');
  const idxTime = cols.indexOf('_time');
  const idxValue = cols.indexOf('_value');
  const out: Point[] = [];
  for (const l of lines) {
    if (l === header) continue;
    const parts = l.split(',');
    if (parts.length <= Math.max(idxTime, idxValue)) continue;
    const t = Date.parse(parts[idxTime]);
    const v = parseFloat(parts[idxValue]);
    if (!Number.isNaN(t) && !Number.isNaN(v)) out.push({ timestamp: t, value: v });
  }
  return out;
}

export async function queryRoomSeries(roomCode: string, startMs: number, endMs: number, windowMs: number): Promise<Point[]> {
  if (!isInfluxConfigured()) return [];
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const esc = escTag(roomCode);
  const flux = `from(bucket: "${bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value")
  |> filter(fn: (r) => r.code == "${esc}")
  |> aggregateWindow(every: ${windowMs}ms, fn: min, createEmpty: false)`;

  const resp = await fetch(`${url}/api/v2/query?org=${encodeURIComponent(org)}`, {
    method: 'POST', headers: headersQuery(), body: flux
  });
  if (!resp.ok) return [];
  const csv = await resp.text();
  const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  const header = lines.find(l => l.includes('_time') && l.includes('_value')) || '';
  const cols = header.split(',');
  const idxTime = cols.indexOf('_time');
  const idxValue = cols.indexOf('_value');
  const out: Point[] = [];
  for (const l of lines) {
    if (l === header) continue;
    const parts = l.split(',');
    if (parts.length <= Math.max(idxTime, idxValue)) continue;
    const t = Date.parse(parts[idxTime]);
    const v = parseFloat(parts[idxValue]);
    if (!Number.isNaN(t) && !Number.isNaN(v)) out.push({ timestamp: t, value: v });
  }
  return out;
}

export async function queryLatestByRooms(roomCodes: string[], lookbackMs: number): Promise<Record<string, number>> {
  if (!isInfluxConfigured() || !roomCodes?.length) return {};
  const startIso = new Date(Date.now() - Math.max(lookbackMs, 5 * 60 * 1000)).toISOString();
  const regex = roomCodes.map(escTag).join('|');
  const flux = `from(bucket: "${bucket}")
  |> range(start: ${startIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value" and r["code"] =~ /${regex}/)
  |> group(columns: ["code"]) 
  |> last()`;
  const resp = await fetch(`${url}/api/v2/query?org=${encodeURIComponent(org)}`, {
    method: 'POST', headers: headersQuery(), body: flux
  });
  if (!resp.ok) return {};
  const csv = await resp.text();
  const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  const header = lines.find(l => l.includes('_value') && l.includes('code')) || '';
  const cols = header.split(',');
  const idxCode = cols.indexOf('code');
  const idxValue = cols.indexOf('_value');
  const out: Record<string, number> = {};
  for (const l of lines) {
    if (l === header) continue;
    const parts = l.split(',');
    if (parts.length <= Math.max(idxCode, idxValue)) continue;
    const code = parts[idxCode];
    const val = parseFloat(parts[idxValue]);
    if (!Number.isNaN(val) && code) out[code] = val;
  }
  return out;
}

