import {sqliteTable,text,integer,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const runs=sqliteTable('studio_runs',{
 id:text('id').notNull(),owner:text('owner').notNull(),projectKey:text('project_key').notNull(),requestHash:text('request_hash').notNull(),status:text('status').notNull(),hops:integer('hops').notNull().default(0),createdAt:integer('created_at').notNull(),sessionId:text('session_id'),resultKey:text('result_key'),error:text('error'),
 // Which provider owns session_id, so cancellation goes to the right API. lease_until is the heartbeat of the invocation streaming the run.
 provider:text('provider').notNull().default('openai'),leaseUntil:integer('lease_until')
},t=>[primaryKey({columns:[t.id,t.owner]})]);
export const locks=sqliteTable('studio_locks',{projectKey:text('project_key').primaryKey(),owner:text('owner').notNull(),runId:text('run_id').notNull()});
export const handoffs=sqliteTable('studio_handoffs',{id:text('id').notNull(),owner:text('owner').notNull(),sourceRun:text('source_run').notNull(),target:text('target').notNull(),summary:text('summary').notNull(),nextTask:text('next_task').notNull(),status:text('status').notNull(),hops:integer('hops').notNull(),createdAt:integer('created_at').notNull(),
 // Durable job fields: background chains run from snapshot_key without the browser; attempts bounds reclaiming after a lost connection.
 background:integer('background').notNull().default(0),snapshotKey:text('snapshot_key'),attempts:integer('attempts').notNull().default(0),runId:text('run_id'),error:text('error')
},t=>[primaryKey({columns:[t.id,t.owner]}),uniqueIndex('handoff_source').on(t.owner,t.sourceRun)]);
// Signed dispatch triggers already processed (replay and duplicate delivery protection).
export const events=sqliteTable('studio_events',{id:text('id').primaryKey(),receivedAt:integer('received_at').notNull()});
