export function generateBookingRef(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const msTwo = String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
  return `BUS${yy}${mm}${dd}${hh}${min}${ss}${msTwo}`;
}
