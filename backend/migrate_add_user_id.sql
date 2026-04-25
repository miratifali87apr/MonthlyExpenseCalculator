-- Migration: Add user_id to all data tables for multi-tenancy
-- Run this against your Supabase/PostgreSQL database ONCE.
-- Existing rows will have user_id = NULL (they remain accessible to no one until reassigned).
-- After running, reassign your existing data by setting user_id to your user ID.

-- Step 1: Add nullable user_id columns
ALTER TABLE properties        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE recurring_templates ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE expense_items     ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE income_items      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Step 1b: Add month_of_year to recurring_templates (for yearly frequency support)
ALTER TABLE recurring_templates ADD COLUMN IF NOT EXISTS month_of_year INTEGER;

-- Step 2: Add indexes for query performance
CREATE INDEX IF NOT EXISTS ix_properties_user_id          ON properties(user_id);
CREATE INDEX IF NOT EXISTS ix_recurring_templates_user_id ON recurring_templates(user_id);
CREATE INDEX IF NOT EXISTS ix_expense_items_user_id       ON expense_items(user_id);
CREATE INDEX IF NOT EXISTS ix_income_items_user_id        ON income_items(user_id);

-- Step 3: Reassign YOUR existing data to your user account.
-- Replace <YOUR_USER_ID> with your actual user ID from the users table.
-- To find it: SELECT id, email FROM users;
--
-- UPDATE properties          SET user_id = <YOUR_USER_ID> WHERE user_id IS NULL;
-- UPDATE recurring_templates SET user_id = <YOUR_USER_ID> WHERE user_id IS NULL;
-- UPDATE expense_items       SET user_id = <YOUR_USER_ID> WHERE user_id IS NULL;
-- UPDATE income_items        SET user_id = <YOUR_USER_ID> WHERE user_id IS NULL;
