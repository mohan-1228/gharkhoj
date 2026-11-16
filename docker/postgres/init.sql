-- Runs once when the local database volume is first created.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Separate database for integration tests.
CREATE DATABASE gharkhoj_test;
\c gharkhoj_test
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
