-- Rename EventType enum values: CAMP -> CLINIC, COMPETITION -> TRYOUT
-- RENAME VALUE updates the label in-place; existing rows automatically reflect the new name.
ALTER TYPE "EventType" RENAME VALUE 'CAMP' TO 'CLINIC';
ALTER TYPE "EventType" RENAME VALUE 'COMPETITION' TO 'TRYOUT';
