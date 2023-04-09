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
