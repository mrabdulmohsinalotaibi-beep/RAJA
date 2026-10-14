const assert=require('node:assert/strict');
const {dayKey,ensureDay,remember}=require('../lesson-core.js');
assert.equal(dayKey(Date.parse('2026-10-14T01:59:59Z')),'2026-10-13');
assert.equal(dayKey(Date.parse('2026-10-14T02:00:00Z')),'2026-10-14');
assert.equal(dayKey(Date.parse('2026-10-14T04:14:59Z'),'07:15'),'2026-10-13');
assert.equal(dayKey(Date.parse('2026-10-14T04:15:00Z'),'07:15'),'2026-10-14');
assert.equal(dayKey(Date.parse('2027-01-01T01:00:00Z')),'2026-12-31');
const list={items:[{id:'one'},{id:'two'}],start:'05:00',minutes:30};
const day=ensureDay(list,Date.parse('2026-10-14T02:00:00Z'));
assert.deepEqual(day.start,{id:'one',offset:0});
remember(list,1800,{id:'two',offset:600});
// Replay never moves the next day's cursor backwards or changes today's anchor.
remember(list,30,{id:'one',offset:30});
assert.deepEqual(list.cursor,{id:'two',offset:600});
assert.deepEqual(ensureDay(list,Date.parse('2026-10-14T23:00:00Z')).start,{id:'one',offset:0});
assert.deepEqual(ensureDay(list,Date.parse('2026-10-15T02:00:00Z')).start,{id:'two',offset:600});
remember(list,1200,{id:null,offset:0});
assert.deepEqual(ensureDay(list,Date.parse('2026-10-16T02:00:00Z')).start,{id:'one',offset:0});
console.log('PASS daily boundaries, custom start, same-day replay, next-day continuation, end-of-list reset');
