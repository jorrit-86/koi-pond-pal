-- Test if it's a schema cache issue by adding a test column
-- This will help us determine if the problem is with the schema cache

-- Add a test column
ALTER TABLE koi ADD COLUMN test_column VARCHAR(20) DEFAULT 'test';

-- Try to query it immediately
SELECT id, name, test_column FROM koi LIMIT 1;

-- If this works, the schema cache is working
-- If this fails, there's a deeper issue

-- Clean up the test column
ALTER TABLE koi DROP COLUMN test_column;
