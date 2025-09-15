-- Check if koi_photos table exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'koi_photos'
  AND table_schema = 'public'
) as koi_photos_table_exists;

-- If table exists, check its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'koi_photos'
AND table_schema = 'public'
ORDER BY ordinal_position;
