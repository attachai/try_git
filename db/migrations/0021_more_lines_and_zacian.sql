-- Adds 30 more characters: Mankey, Spheal, Starly, Budew and Pawniard three-stage
-- lines, the Deino and Frigibax dragon lines, Ponyta, Seel, Phanpy and Larvesta
-- two-stage lines, and Zacian in the shop. Base forms are sold in the
-- shop; evolved forms are evolution-only (price 0). INSERT OR IGNORE leaves existing
-- rows untouched, and each character has at most one outgoing evolution path.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_mankey', '56', 'Mankey', 'mankey', 'Fighting', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/56.png', 400, 'COMMON'),
  ('char_primeape', '57', 'Primeape', 'primeape', 'Fighting', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/57.png', 0, 'RARE'),
  ('char_annihilape', '979', 'Annihilape', 'annihilape', 'Fighting', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/979.png', 0, 'EPIC'),
  ('char_spheal', '363', 'Spheal', 'spheal', 'Ice', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/363.png', 350, 'COMMON'),
  ('char_sealeo', '364', 'Sealeo', 'sealeo', 'Ice', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/364.png', 0, 'RARE'),
  ('char_walrein', '365', 'Walrein', 'walrein', 'Ice', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/365.png', 0, 'EPIC'),
  ('char_starly', '396', 'Starly', 'starly', 'Normal', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/396.png', 350, 'COMMON'),
  ('char_staravia', '397', 'Staravia', 'staravia', 'Normal', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/397.png', 0, 'RARE'),
  ('char_staraptor', '398', 'Staraptor', 'staraptor', 'Normal', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/398.png', 0, 'EPIC'),
  ('char_budew', '406', 'Budew', 'budew', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/406.png', 350, 'COMMON'),
  ('char_roselia', '315', 'Roselia', 'roselia', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/315.png', 0, 'RARE'),
  ('char_roserade', '407', 'Roserade', 'roserade', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/407.png', 0, 'EPIC'),
  ('char_pawniard', '624', 'Pawniard', 'pawniard', 'Dark', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/624.png', 450, 'COMMON'),
  ('char_bisharp', '625', 'Bisharp', 'bisharp', 'Dark', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/625.png', 0, 'RARE'),
  ('char_kingambit', '983', 'Kingambit', 'kingambit', 'Dark', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/983.png', 0, 'EPIC'),
  ('char_deino', '633', 'Deino', 'deino', 'Dark', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/633.png', 600, 'RARE'),
  ('char_zweilous', '634', 'Zweilous', 'zweilous', 'Dark', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/634.png', 0, 'EPIC'),
  ('char_hydreigon', '635', 'Hydreigon', 'hydreigon', 'Dark', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/635.png', 0, 'LEGENDARY'),
  ('char_frigibax', '996', 'Frigibax', 'frigibax', 'Dragon', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/996.png', 600, 'RARE'),
  ('char_arctibax', '997', 'Arctibax', 'arctibax', 'Dragon', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/997.png', 0, 'EPIC'),
  ('char_baxcalibur', '998', 'Baxcalibur', 'baxcalibur', 'Dragon', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/998.png', 0, 'LEGENDARY'),
  ('char_ponyta', '77', 'Ponyta', 'ponyta', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/77.png', 400, 'COMMON'),
  ('char_rapidash', '78', 'Rapidash', 'rapidash', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/78.png', 0, 'RARE'),
  ('char_seel', '86', 'Seel', 'seel', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/86.png', 350, 'COMMON'),
  ('char_dewgong', '87', 'Dewgong', 'dewgong', 'Water', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/87.png', 0, 'RARE'),
  ('char_phanpy', '231', 'Phanpy', 'phanpy', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/231.png', 400, 'COMMON'),
  ('char_donphan', '232', 'Donphan', 'donphan', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/232.png', 0, 'RARE'),
  ('char_larvesta', '636', 'Larvesta', 'larvesta', 'Bug', 'Fire', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/636.png', 600, 'RARE'),
  ('char_volcarona', '637', 'Volcarona', 'volcarona', 'Bug', 'Fire', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/637.png', 0, 'EPIC'),
  ('char_zacian', '888', 'Zacian', 'zacian', 'Fairy', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/888.png', 3000, 'LEGENDARY');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_mankey_primeape', 'char_mankey', 'char_primeape', 600),
  ('evo_primeape_annihilape', 'char_primeape', 'char_annihilape', 1000),
  ('evo_spheal_sealeo', 'char_spheal', 'char_sealeo', 600),
  ('evo_sealeo_walrein', 'char_sealeo', 'char_walrein', 1000),
  ('evo_starly_staravia', 'char_starly', 'char_staravia', 600),
  ('evo_staravia_staraptor', 'char_staravia', 'char_staraptor', 1000),
  ('evo_budew_roselia', 'char_budew', 'char_roselia', 600),
  ('evo_roselia_roserade', 'char_roselia', 'char_roserade', 1000),
  ('evo_pawniard_bisharp', 'char_pawniard', 'char_bisharp', 600),
  ('evo_bisharp_kingambit', 'char_bisharp', 'char_kingambit', 1000),
  ('evo_deino_zweilous', 'char_deino', 'char_zweilous', 1000),
  ('evo_zweilous_hydreigon', 'char_zweilous', 'char_hydreigon', 1500),
  ('evo_frigibax_arctibax', 'char_frigibax', 'char_arctibax', 1000),
  ('evo_arctibax_baxcalibur', 'char_arctibax', 'char_baxcalibur', 1500),
  ('evo_ponyta_rapidash', 'char_ponyta', 'char_rapidash', 800),
  ('evo_seel_dewgong', 'char_seel', 'char_dewgong', 800),
  ('evo_phanpy_donphan', 'char_phanpy', 'char_donphan', 800),
  ('evo_larvesta_volcarona', 'char_larvesta', 'char_volcarona', 1000);
