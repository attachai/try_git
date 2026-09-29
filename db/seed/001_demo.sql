INSERT INTO families (id, name) VALUES ('fam_demo', 'Demo Family');

INSERT INTO users (id, email, password_hash, display_name, role) VALUES
  ('usr_dad', 'dad@example.test', NULL, 'Demo Dad', 'PARENT'),
  ('usr_child', 'child@example.test', NULL, 'Nong Demo', 'CHILD');

INSERT INTO family_members (id, family_id, user_id, relation) VALUES
  ('fm_dad', 'fam_demo', 'usr_dad', 'FATHER'),
  ('fm_child', 'fam_demo', 'usr_child', 'CHILD');

INSERT INTO children (id, family_id, user_id, display_name, points_balance)
VALUES ('child_demo', 'fam_demo', 'usr_child', 'Nong Demo', 2000);

INSERT INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_pikachu', '25', 'Pikachu', 'pikachu', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png', 500, 'RARE'),
  ('char_eevee', '133', 'Eevee', 'eevee', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png', 450, 'COMMON'),
  ('char_charmander', '4', 'Charmander', 'charmander', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png', 400, 'COMMON'),
  ('char_charmeleon', '5', 'Charmeleon', 'charmeleon', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/5.png', 0, 'RARE'),
  ('char_charizard', '6', 'Charizard', 'charizard', 'Fire', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png', 0, 'EPIC'),
  ('char_squirtle', '7', 'Squirtle', 'squirtle', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png', 400, 'COMMON'),
  ('char_bulbasaur', '1', 'Bulbasaur', 'bulbasaur', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png', 400, 'COMMON'),
  ('char_snorlax', '143', 'Snorlax', 'snorlax', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png', 800, 'RARE'),
  ('char_gengar', '94', 'Gengar', 'gengar', 'Ghost', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png', 900, 'EPIC'),
  ('char_lucario', '448', 'Lucario', 'lucario', 'Fighting', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png', 1000, 'EPIC');

INSERT INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_charmander_charmeleon', 'char_charmander', 'char_charmeleon', 600),
  ('evo_charmeleon_charizard', 'char_charmeleon', 'char_charizard', 1000);

INSERT INTO point_transactions (id, child_id, created_by, transaction_type, points, reason) VALUES
  ('pt_demo_1', 'child_demo', 'usr_dad', 'EARN', 100, 'ทำการบ้านเสร็จเอง'),
  ('pt_demo_2', 'child_demo', 'usr_dad', 'EARN', 50, 'ช่วยเก็บจาน'),
  ('pt_demo_3', 'child_demo', 'usr_dad', 'DEDUCT', -30, 'เล่นเกมเกินเวลาที่ตกลง');
