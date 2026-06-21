-- =========================================================
-- VORTEX - Base minimale pour VENDIA et PROFILIO
-- À copier dans l'éditeur SQL Supabase/PostgreSQL
-- Hypothèse : la table existante `utilisateurs(id)` existe déjà
-- et `id` est de type BIGINT / INT8.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Extension utile
-- ---------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 2) VENDIA
-- ---------------------------------------------------------

create table if not exists vendia_categories (
    id uuid primary key default gen_random_uuid(),
    nom varchar(120) not null unique,
    slug varchar(140) not null unique,
    ordre_affichage integer not null default 0,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists vendia_boutiques (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references utilisateurs(id) on delete cascade,
    nom_boutique varchar(160) not null,
    description text,
    telephone varchar(40),
    ville varchar(120),
    commune varchar(120),
    quartier varchar(120),
    adresse_detail text,
    lat double precision,
    lon double precision,
    est_actif boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_vendia_boutiques_user_id on vendia_boutiques(user_id);
create index if not exists idx_vendia_boutiques_localisation on vendia_boutiques(lat, lon);

create table if not exists vendia_produits (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references vendia_boutiques(id) on delete cascade,
    categorie_id uuid references vendia_categories(id) on delete set null,
    nom varchar(180) not null,
    description text,
    prix numeric(12,2) not null default 0,
    devise varchar(10) not null default 'FCFA',
    stock integer not null default 0,
    unite varchar(60),
    vente_particuliere varchar(180),
    image_url text,
    actif boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_vendia_produits_boutique_id on vendia_produits(boutique_id);
create index if not exists idx_vendia_produits_categorie_id on vendia_produits(categorie_id);
create index if not exists idx_vendia_produits_nom on vendia_produits using gin (to_tsvector('simple', nom));

create table if not exists vendia_publicites (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references vendia_boutiques(id) on delete cascade,
    titre varchar(180) not null,
    description text,
    media_url text not null,
    media_type varchar(30) not null check (media_type in ('image', 'video')),
    actif boolean not null default true,
    ordre_affichage integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_vendia_publicites_boutique_id on vendia_publicites(boutique_id);

-- ---------------------------------------------------------
-- 3) PROFILIO
-- ---------------------------------------------------------

create table if not exists profilio_metiers (
    id uuid primary key default gen_random_uuid(),
    nom varchar(140) not null unique,
    slug varchar(160) not null unique,
    ordre_affichage integer not null default 0,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists profilio_profils (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null unique references utilisateurs(id) on delete cascade,
    metier_id uuid references profilio_metiers(id) on delete set null,
    titre_profil varchar(180) not null,
    presentation text,
    competences text,
    services text,
    ville varchar(120),
    commune varchar(120),
    quartier varchar(120),
    lat double precision,
    lon double precision,
    disponible boolean not null default true,
    photo_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_profilio_profils_user_id on profilio_profils(user_id);
create index if not exists idx_profilio_profils_metier_id on profilio_profils(metier_id);
create index if not exists idx_profilio_profils_localisation on profilio_profils(lat, lon);

create table if not exists profilio_publicites (
    id uuid primary key default gen_random_uuid(),
    profil_id uuid not null references profilio_profils(id) on delete cascade,
    titre varchar(180) not null,
    description text,
    media_url text not null,
    media_type varchar(30) not null check (media_type in ('image', 'video')),
    actif boolean not null default true,
    ordre_affichage integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_profilio_publicites_profil_id on profilio_publicites(profil_id);

-- ---------------------------------------------------------
-- 4) Colonnes utiles sur utilisateurs
-- ---------------------------------------------------------

alter table utilisateurs
    add column if not exists is_vendia_seller boolean not null default false;

alter table utilisateurs
    add column if not exists is_profilio_member boolean not null default false;

-- ---------------------------------------------------------
-- 5) Données initiales
-- ---------------------------------------------------------

insert into vendia_categories (nom, slug, ordre_affichage)
values
    ('Alimentation', 'alimentation', 1),
    ('Boissons', 'boissons', 2),
    ('Maison', 'maison', 3),
    ('Beauté', 'beaute', 4),
    ('Électronique', 'electronique', 5),
    ('Mode', 'mode', 6),
    ('Bricolage', 'bricolage', 7),
    ('Autre', 'autre', 8)
on conflict (slug) do nothing;

insert into profilio_metiers (nom, slug, ordre_affichage)
values
    ('Ingénieur', 'ingenieur', 1),
    ('Secrétaire', 'secretaire', 2),
    ('Comptable', 'comptable', 3),
    ('Développeur', 'developpeur', 4),
    ('Plombier', 'plombier', 5),
    ('Designer', 'designer', 6),
    ('Électricien', 'electricien', 7),
    ('Assistant administratif', 'assistant-administratif', 8)
on conflict (slug) do nothing;

-- ---------------------------------------------------------
-- 6) Trigger updated_at
-- ---------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_vendia_boutiques_updated_at on vendia_boutiques;
create trigger trg_vendia_boutiques_updated_at
before update on vendia_boutiques
for each row
execute function set_updated_at();

drop trigger if exists trg_vendia_produits_updated_at on vendia_produits;
create trigger trg_vendia_produits_updated_at
before update on vendia_produits
for each row
execute function set_updated_at();

drop trigger if exists trg_profilio_profils_updated_at on profilio_profils;
create trigger trg_profilio_profils_updated_at
before update on profilio_profils
for each row
execute function set_updated_at();
