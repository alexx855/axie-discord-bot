CREATE TABLE recent_sales (
  id serial PRIMARY KEY,
  from_address varchar(255) NOT NULL,
  to_address varchar(255) NOT NULL,
  tx_hash varchar(255) NOT NULL,
  price bigint NOT NULL,
  price_usd float NOT NULL,
  token_id bigint NOT NULL,
  token_address varchar(255) NOT NULL,
  token_type varchar(255) NOT NULL,
  created_at timestamp NOT NULL
);
CREATE TABLE axies (
  id bigint PRIMARY KEY,
  breedCount int,
  class varchar(255),
  parts varchar(255)[]
);
CREATE TABLE items (
  id varchar(255) PRIMARY KEY,
  class varchar(255) NOT NULL,
  category varchar(255) NOT NULL,
  rarity varchar(255) NOT NULL,
  description varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  token_id bigint NOT NULL,
  token_address varchar(255) NOT NULL,
  image_url varchar(255) NOT NULL
);
CREATE TABLE cards (
  id bigint PRIMARY KEY,
  name varchar(255) NOT NULL,
  description varchar(255) NOT NULL,
  part_class varchar(255) NOT NULL,
  part_type varchar(255) NOT NULL,
  part_value int NOT NULL,
  energy int NOT NULL,
  attack int NOT NULL,
  defense int NOT NULL,
  healing int NOT NULL,
  ability_type varchar(255) NOT NULL,
  level int NOT NULL,
  tags varchar(255)[] NOT NULL
);
