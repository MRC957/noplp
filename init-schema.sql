-- Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS karaoke;

-- Set the search path to include karaoke schema
ALTER DATABASE karaoke SET search_path TO karaoke, public;

-- Grant privileges
GRANT ALL ON SCHEMA karaoke TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA karaoke TO postgres;