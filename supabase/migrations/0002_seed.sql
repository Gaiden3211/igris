-- Reference data. See docs/DATA_SOURCES.md for source access and audit history.
insert into domains (id, name, description, sort_order) values
  ('combustion-science', 'Combustion Science', 'Microgravity flame, flammability, fire detection and suppression investigations.', 10)
on conflict (id) do nothing;

insert into parameter_definitions (id, domain_id, label_en, label_uk, unit, kind, sort_order) values
  ('fuel_type',     'combustion-science', 'Fuel / material',       'Паливо / матеріал',        null,   'category', 10),
  ('fuel_state',    'combustion-science', 'Fuel state',            'Стан палива',              null,   'category', 20),
  ('sample_geometry','combustion-science','Sample or burner geometry','Геометрія зразка чи пальника', null, 'text', 30),
  ('oxygen_pct',    'combustion-science', 'Oxygen concentration',  'Концентрація кисню',       '% vol','range',    40),
  ('pressure_kpa',  'combustion-science', 'Pressure',              'Тиск',                     'kPa',  'range',    50),
  ('flow_speed_cm_s','combustion-science','Flow speed',            'Швидкість потоку',         'cm/s', 'range',    60),
  ('diluent',       'combustion-science', 'Diluent / suppressant', 'Розріджувач / вогнегасна речовина', null, 'category', 70),
  ('gravity_level', 'combustion-science', 'Gravity level',         'Рівень гравітації',        null,   'category', 80),
  ('measurements',  'combustion-science', 'Sensors and measurements','Датчики та вимірювання', null,   'text',     90)
on conflict (id) do nothing;

-- Scenario values archived in docs/source-audit-2026-11-14.json; their source could not be reverified.

insert into sources (kind, title, url, publisher, license_note, used_for, sort_order) values
  ('data', 'Physical Sciences Informatics (PSI) repository', 'https://psi.nasa.gov/geode-py/ws/repo/search?source=psi&type=investigation&size=1&from=0', 'NASA Biological and Physical Sciences', 'Open data', 'Investigation metadata, file inventories, publications', 10),
  ('data', 'NASA Technical Reports Server (NTRS) API', 'https://ntrs.nasa.gov/api/citations/search?q=combustion&page.size=1', 'NASA STI Program', 'Open data', 'Related technical reports and abstracts', 20),
  ('reference', 'NASA Combustion Science', 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/', 'NASA Glenn Research Center', null, 'Background', 40),
  ('reference', 'A Researcher''s Guide to International Space Station Combustion Science', 'https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/', 'NASA', null, 'Background', 50),
  ('reference', 'Apollo 1', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-1', 'NASA Safety and Mission Assurance', null, 'Background', 60),
  ('reference', 'Apollo 13', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-13', 'NASA Safety and Mission Assurance', null, 'Background', 70),
  ('reference', '25 Years Ago: Fire Aboard Space Station Mir', 'https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/', 'NASA', null, 'Background', 80),
  ('reference', 'Fireman''s Air Tanks (Spinoff)', 'https://spinoff.nasa.gov/node/9582', 'NASA Spinoff', null, 'Earth applications', 90),
  ('reference', 'Fire Detector (Spinoff)', 'https://spinoff.nasa.gov/node/9407', 'NASA Spinoff', null, 'Earth applications', 100),
  ('reference', 'New Technology for the Fire Attire (Spinoff)', 'https://spinoff.nasa.gov/node/9918', 'NASA Spinoff', null, 'Earth applications', 110),
  ('software', 'Astryx design system', 'https://github.com/meta/astryx', 'Meta', 'MIT', 'User interface components', 200),
  ('ai', 'Radium API (model configured by RADIUM_MODEL)', 'https://radium.cloud/', 'Radium', null, 'Assistant answers: query planning and cited summaries', 300)
on conflict (url) do nothing;
