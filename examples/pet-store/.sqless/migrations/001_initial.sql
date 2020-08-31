CREATE TABLE category (
    id serial NOT NULL PRIMARY KEY,
    name varchar(200) NOT NULL
);
INSERT INTO category (name)
VALUES ('dog'),
    ('cat');
CREATE TABLE "user" (
    id serial NOT NULL PRIMARY KEY,
    username varchar(200),
    first_name varchar(200),
    last_name varchar(200),
    email varchar(400),
    "password" varchar(1024),
    phone varchar(40),
    user_status int
);
CREATE TABLE tag (
    id serial NOT NULL PRIMARY KEY,
    name varchar(200) NOT NULL
);
CREATE TABLE pet (
    id serial NOT NULL PRIMARY KEY,
    name varchar(200) NOT NULL,
    photo_urls text [] NOT NULL,
    status varchar(20) NOT NULL,
    category int4 NOT NULL REFERENCES category(id)
);
CREATE TABLE pet_tag (
    pet int4 REFERENCES pet(id),
    tag int4 REFERENCES tag(id),
    PRIMARY KEY (pet, tag)
);
CREATE TABLE "order" (
    id serial NOT NULL PRIMARY KEY,
    pet_id int4 NOT NULL REFERENCES pet(id),
    quantity int,
    ship_date timestamptz,
    status varchar(20),
    complete boolean DEFAULT false
);