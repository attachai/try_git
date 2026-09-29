INSERT INTO families (id, name) VALUES ('fam_demo', 'Demo Family');

INSERT INTO users (id, email, password_hash, display_name, role) VALUES
  ('usr_dad', 'dad@example.test', NULL, 'Demo Dad', 'PARENT'),
  ('usr_child', 'child@example.test', NULL, 'Nong Demo', 'CHILD');

INSERT INTO family_members (id, family_id, user_id, relation) VALUES
  ('fm_dad', 'fam_demo', 'usr_dad', 'FATHER'),
  ('fm_child', 'fam_demo', 'usr_child', 'CHILD');

INSERT INTO children (id, family_id, user_id, display_name, points_balance)
VALUES ('child_demo', 'fam_demo', 'usr_child', 'Nong Demo', 1880);

INSERT INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_pikachu', '25', 'Pikachu', 'pikachu', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png', 500, 'RARE'),
  ('char_raichu', '26', 'Raichu', 'raichu', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/26.png', 0, 'EPIC'),
  ('char_eevee', '133', 'Eevee', 'eevee', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png', 450, 'COMMON'),
  ('char_charmander', '4', 'Charmander', 'charmander', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png', 400, 'COMMON'),
  ('char_charmeleon', '5', 'Charmeleon', 'charmeleon', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/5.png', 0, 'RARE'),
  ('char_charizard', '6', 'Charizard', 'charizard', 'Fire', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png', 0, 'EPIC'),
  ('char_squirtle', '7', 'Squirtle', 'squirtle', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png', 400, 'COMMON'),
  ('char_wartortle', '8', 'Wartortle', 'wartortle', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/8.png', 0, 'RARE'),
  ('char_blastoise', '9', 'Blastoise', 'blastoise', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png', 0, 'EPIC'),
  ('char_bulbasaur', '1', 'Bulbasaur', 'bulbasaur', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png', 400, 'COMMON'),
  ('char_ivysaur', '2', 'Ivysaur', 'ivysaur', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/2.png', 0, 'RARE'),
  ('char_venusaur', '3', 'Venusaur', 'venusaur', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/3.png', 0, 'EPIC'),
  ('char_snorlax', '143', 'Snorlax', 'snorlax', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png', 800, 'RARE'),
  ('char_gengar', '94', 'Gengar', 'gengar', 'Ghost', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png', 900, 'EPIC'),
  ('char_lucario', '448', 'Lucario', 'lucario', 'Fighting', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png', 1000, 'EPIC');

INSERT INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_pikachu_raichu', 'char_pikachu', 'char_raichu', 800),
  ('evo_charmander_charmeleon', 'char_charmander', 'char_charmeleon', 600),
  ('evo_charmeleon_charizard', 'char_charmeleon', 'char_charizard', 1000),
  ('evo_squirtle_wartortle', 'char_squirtle', 'char_wartortle', 600),
  ('evo_wartortle_blastoise', 'char_wartortle', 'char_blastoise', 1000),
  ('evo_bulbasaur_ivysaur', 'char_bulbasaur', 'char_ivysaur', 600),
  ('evo_ivysaur_venusaur', 'char_ivysaur', 'char_venusaur', 1000);

INSERT INTO point_transactions (id, child_id, created_by, transaction_type, points, reason) VALUES
  ('pt_demo_1', 'child_demo', 'usr_dad', 'EARN', 100, 'ทำการบ้านเสร็จเอง'),
  ('pt_demo_2', 'child_demo', 'usr_dad', 'EARN', 50, 'ช่วยเก็บจาน'),
  ('pt_demo_3', 'child_demo', 'usr_dad', 'DEDUCT', -30, 'เล่นเกมเกินเวลาที่ตกลง');
