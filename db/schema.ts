import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dailyBriefings = sqliteTable('daily_briefings', {
  date: text('date').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
