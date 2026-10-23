import {sqliteTable,text,integer,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const runs=sqliteTable('studio_runs',{
 id:text('id').notNull(),owner:text('owner').notNull(),projectKey:text('project_key').notNull(),requestHash:text('request_hash').notNull(),status:text('status').notNull(),hops:integer('hops').notNull().default(0),createdAt:integer('created_at').notNull(),sessionId:text('session_id'),resultKey:text('result_key'),error:text('error')
},t=>[primaryKey({columns:[t.id,t.owner]})]);
export const locks=sqliteTable('studio_locks',{projectKey:text('project_key').primaryKey(),owner:text('owner').notNull(),runId:text('run_id').notNull()});
export const handoffs=sqliteTable('studio_handoffs',{id:text('id').notNull(),owner:text('owner').notNull(),sourceRun:text('source_run').notNull(),target:text('target').notNull(),summary:text('summary').notNull(),nextTask:text('next_task').notNull(),status:text('status').notNull(),hops:integer('hops').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.id,t.owner]}),uniqueIndex('handoff_source').on(t.owner,t.sourceRun)]);
