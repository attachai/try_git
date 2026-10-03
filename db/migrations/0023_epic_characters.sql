-- Adds 20 EPIC characters sold in the shop as single forms (1000-1200 points), so the
-- mystery box's EPIC tier has more to give: Aerodactyl, Kangaskhan, Tauros, Pinsir,
-- Heracross, Skarmory, Tropius, Sableye, Mawile, Torkoal, Spiritomb, Rotom,
-- Druddigon, Bouffalant, Hawlucha, Mimikyu, Turtonator, Drampa, Togedemaru, Dhelmise.
-- INSERT OR IGNORE leaves existing rows untouched.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_aerodactyl', '142', 'Aerodactyl', 'aerodactyl', 'Rock', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/142.png', 1200, 'EPIC'),
  ('char_kangaskhan', '115', 'Kangaskhan', 'kangaskhan', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/115.png', 1000, 'EPIC'),
  ('char_tauros', '128', 'Tauros', 'tauros', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/128.png', 1000, 'EPIC'),
  ('char_pinsir', '127', 'Pinsir', 'pinsir', 'Bug', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/127.png', 1000, 'EPIC'),
  ('char_heracross', '214', 'Heracross', 'heracross', 'Bug', 'Fighting', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/214.png', 1000, 'EPIC'),
  ('char_skarmory', '227', 'Skarmory', 'skarmory', 'Steel', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/227.png', 1000, 'EPIC'),
  ('char_tropius', '357', 'Tropius', 'tropius', 'Grass', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/357.png', 1000, 'EPIC'),
  ('char_sableye', '302', 'Sableye', 'sableye', 'Dark', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/302.png', 1000, 'EPIC'),
  ('char_mawile', '303', 'Mawile', 'mawile', 'Steel', 'Fairy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/303.png', 1000, 'EPIC'),
  ('char_torkoal', '324', 'Torkoal', 'torkoal', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/324.png', 1000, 'EPIC'),
  ('char_spiritomb', '442', 'Spiritomb', 'spiritomb', 'Ghost', 'Dark', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/442.png', 1000, 'EPIC'),
  ('char_rotom', '479', 'Rotom', 'rotom', 'Electric', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/479.png', 1200, 'EPIC'),
  ('char_druddigon', '621', 'Druddigon', 'druddigon', 'Dragon', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/621.png', 1000, 'EPIC'),
  ('char_bouffalant', '626', 'Bouffalant', 'bouffalant', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/626.png', 1000, 'EPIC'),
  ('char_hawlucha', '701', 'Hawlucha', 'hawlucha', 'Fighting', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/701.png', 1000, 'EPIC'),
  ('char_mimikyu', '778', 'Mimikyu', 'mimikyu', 'Ghost', 'Fairy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/778.png', 1200, 'EPIC'),
  ('char_turtonator', '776', 'Turtonator', 'turtonator', 'Fire', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/776.png', 1000, 'EPIC'),
  ('char_drampa', '780', 'Drampa', 'drampa', 'Normal', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/780.png', 1000, 'EPIC'),
  ('char_togedemaru', '777', 'Togedemaru', 'togedemaru', 'Electric', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/777.png', 1000, 'EPIC'),
  ('char_dhelmise', '781', 'Dhelmise', 'dhelmise', 'Ghost', 'Grass', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/781.png', 1000, 'EPIC');
