UPDATE doctors
SET location = ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  AND location IS NULL;

UPDATE doctors
SET location = ST_SetSRID(ST_MakePoint(79.8700, 6.9150), 4326)
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND location IS NULL;

UPDATE doctors
SET location = ST_SetSRID(ST_MakePoint(79.8600, 6.9200), 4326)
WHERE location IS NULL;
