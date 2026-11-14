-- Reference data. Figures for scenarios come from the challenge statement (see docs/DATA_SOURCES.md).
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

insert into scenarios (id, domain_id, name_en, name_uk, description_en, description_uk, targets, source_url, sort_order) values
  ('station-cabin', 'combustion-science', 'Space station cabin', 'Кабіна космічної станції',
   'Earth-like atmosphere: about 21% oxygen at 14.7 psi (101.3 kPa).',
   'Атмосфера, близька до земної: близько 21% кисню при 14.7 psi (101.3 кПа).',
   '{"oxygen_pct":{"min":20,"max":22},"pressure_kpa":{"min":95,"max":103}}',
   'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/', 10),
  ('surface-habitat', 'combustion-science', 'Lunar habitat or pressurized rover', 'База на Місяці або герметичний ровер',
   'Expected between suit and Earth conditions: 30% oxygen or more at 10.2 psi (70.3 kPa) or less.',
   'Очікувано між умовами скафандра і Землі: 30% кисню і більше при 10.2 psi (70.3 кПа) і менше.',
   '{"oxygen_pct":{"min":30,"max":100},"pressure_kpa":{"min":0,"max":70.3}}',
   'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/', 20),
  ('spacesuit', 'combustion-science', 'Spacesuit', 'Скафандр',
   'Pure oxygen at about 4.3 psi (29.6 kPa).',
   'Чистий кисень при близько 4.3 psi (29.6 кПа).',
   '{"oxygen_pct":{"min":95,"max":100},"pressure_kpa":{"min":25,"max":35}}',
   'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/', 30)
on conflict (id) do nothing;

insert into sources (kind, title, url, publisher, license_note, used_for, sort_order) values
  ('data', 'Physical Sciences Informatics (PSI) repository', 'https://psi.nasa.gov/physci/repo/search?q=combustion', 'NASA Biological and Physical Sciences', 'Open data', 'Investigation metadata, file inventories, publications', 10),
  ('data', 'NASA Technical Reports Server (NTRS) API', 'https://ntrs.nasa.gov/api/openapi/', 'NASA STI Program', 'Open data', 'Related technical reports and abstracts', 20),
  ('reference', 'Flame in Freefall challenge statement', 'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/', 'NASA Space Apps Challenge', null, 'Scope, scenarios, hardware groupings', 30),
  ('reference', 'NASA Combustion Science', 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/', 'NASA Glenn Research Center', null, 'Background', 40),
  ('reference', 'A Researcher''s Guide to International Space Station Combustion Science', 'https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/', 'NASA', null, 'Background', 50),
  ('reference', 'Apollo 1', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-1', 'NASA Safety and Mission Assurance', null, 'Background', 60),
  ('reference', 'Apollo 13', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-13', 'NASA Safety and Mission Assurance', null, 'Background', 70),
  ('reference', '25 Years Ago: Fire Aboard Space Station Mir', 'https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/', 'NASA', null, 'Background', 80),
  ('reference', 'Fireman''s Air Tanks (Spinoff)', 'https://spinoff.nasa.gov/node/9582', 'NASA Spinoff', null, 'Earth applications', 90),
  ('reference', 'Fire Detector (Spinoff)', 'https://spinoff.nasa.gov/node/9407', 'NASA Spinoff', null, 'Earth applications', 100),
  ('reference', 'New Technology for the Fire Attire (Spinoff)', 'https://spinoff.nasa.gov/node/9918', 'NASA Spinoff', null, 'Earth applications', 110),
  ('software', 'Astryx design system', 'https://github.com/meta/astryx', 'Meta', 'MIT', 'User interface components', 200),
  ('ai', 'Radium API (model configured by RADIUM_MODEL)', 'https://api.radium.cloud/v1', 'Radium', null, 'Assistant answers: query planning and cited summaries', 300)
on conflict (url) do nothing;
