--
-- PostgreSQL database dump
--

\restrict VMg9XP2QY1bVme6sAGGgQcjCmLEHMVbGiXaYySubz37O8fcuyHNd12dUuPj0z34

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg12+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_specs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_specs (
    id integer NOT NULL,
    spec_code character varying(500) NOT NULL,
    spec_name character varying(500),
    classification_code character varying(200),
    classification_desc character varying(500),
    category character varying(500),
    family character varying(500),
    type character varying(500),
    manufacturer character varying(500),
    address character varying(500),
    phone character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_id integer,
    uuid uuid DEFAULT gen_random_uuid()
);


--
-- Name: asset_specs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_specs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_specs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_specs_id_seq OWNED BY public.asset_specs.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    asset_code character varying(500) NOT NULL,
    spec_code character varying(500),
    name character varying(500),
    floor character varying(200),
    room character varying(500),
    db_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_id integer,
    uuid uuid DEFAULT gen_random_uuid()
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: classifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classifications (
    id integer NOT NULL,
    classification_code character varying(200) NOT NULL,
    classification_desc character varying(500),
    classification_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_id integer
);


--
-- Name: classifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classifications_id_seq OWNED BY public.classifications.id;


--
-- Name: document_exif; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_exif (
    id integer NOT NULL,
    document_id integer NOT NULL,
    date_time timestamp without time zone,
    image_width integer,
    image_height integer,
    equip_model character varying(255),
    f_number numeric(5,2),
    exposure_time character varying(50),
    iso_speed integer,
    focal_length numeric(10,2),
    gps_longitude numeric(12,8),
    gps_latitude numeric(11,8),
    gps_altitude numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: document_exif_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_exif_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_exif_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_exif_id_seq OWNED BY public.document_exif.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(50),
    mime_type character varying(100),
    asset_code character varying(100),
    space_code character varying(100),
    spec_code character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    view_id integer,
    openwebui_file_id character varying(255)
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: influx_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.influx_configs (
    id integer NOT NULL,
    file_id integer,
    influx_url character varying(500) NOT NULL,
    influx_port integer DEFAULT 8086,
    influx_org character varying(200) NOT NULL,
    influx_bucket character varying(200) NOT NULL,
    influx_token text,
    influx_user character varying(200),
    influx_password text,
    use_basic_auth boolean DEFAULT false,
    is_enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: influx_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.influx_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: influx_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.influx_configs_id_seq OWNED BY public.influx_configs.id;


--
-- Name: kb_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kb_id uuid NOT NULL,
    document_id integer,
    openwebui_kb_id character varying(255),
    sync_status character varying(20) DEFAULT 'pending'::character varying,
    sync_error text,
    synced_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    openwebui_file_id character varying(255)
);


--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_bases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id integer NOT NULL,
    openwebui_kb_id character varying(255) NOT NULL,
    kb_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: mapping_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapping_configs (
    id integer NOT NULL,
    file_id integer NOT NULL,
    config_type character varying(50) NOT NULL,
    field_name character varying(100) NOT NULL,
    category character varying(200),
    property character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: mapping_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mapping_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mapping_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mapping_configs_id_seq OWNED BY public.mapping_configs.id;


--
-- Name: model_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_files (
    id integer NOT NULL,
    file_code character varying(100) NOT NULL,
    title character varying(200) NOT NULL,
    original_name character varying(500),
    file_path character varying(1000),
    file_size bigint,
    status character varying(20) DEFAULT 'uploaded'::character varying,
    is_active boolean DEFAULT false,
    extracted_path character varying(1000),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: model_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.model_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: model_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.model_files_id_seq OWNED BY public.model_files.id;


--
-- Name: spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spaces (
    id integer NOT NULL,
    space_code character varying(500) NOT NULL,
    name character varying(500),
    classification_code character varying(200),
    classification_desc character varying(500),
    floor character varying(200),
    area numeric(15,4),
    perimeter numeric(15,4),
    db_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_id integer,
    uuid uuid DEFAULT gen_random_uuid()
);


--
-- Name: spaces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.spaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: spaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.spaces_id_seq OWNED BY public.spaces.id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text,
    description character varying(255),
    is_encrypted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;


--
-- Name: views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.views (
    id integer NOT NULL,
    file_id integer NOT NULL,
    name character varying(255) NOT NULL,
    thumbnail text,
    camera_state jsonb,
    isolation_state jsonb,
    selection_state jsonb,
    theming_state jsonb,
    environment character varying(100),
    cutplanes jsonb,
    explode_scale double precision,
    render_options jsonb,
    other_settings jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewer_state jsonb,
    is_default boolean DEFAULT false
);


--
-- Name: views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.views_id_seq OWNED BY public.views.id;


--
-- Name: asset_specs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_specs ALTER COLUMN id SET DEFAULT nextval('public.asset_specs_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: classifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classifications ALTER COLUMN id SET DEFAULT nextval('public.classifications_id_seq'::regclass);


--
-- Name: document_exif id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exif ALTER COLUMN id SET DEFAULT nextval('public.document_exif_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: influx_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influx_configs ALTER COLUMN id SET DEFAULT nextval('public.influx_configs_id_seq'::regclass);


--
-- Name: mapping_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapping_configs ALTER COLUMN id SET DEFAULT nextval('public.mapping_configs_id_seq'::regclass);


--
-- Name: model_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_files ALTER COLUMN id SET DEFAULT nextval('public.model_files_id_seq'::regclass);


--
-- Name: spaces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces ALTER COLUMN id SET DEFAULT nextval('public.spaces_id_seq'::regclass);


--
-- Name: system_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);


--
-- Name: views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.views ALTER COLUMN id SET DEFAULT nextval('public.views_id_seq'::regclass);


--
-- Name: asset_specs asset_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_specs
    ADD CONSTRAINT asset_specs_pkey PRIMARY KEY (id);


--
-- Name: assets assets_file_asset_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_file_asset_unique UNIQUE (file_id, asset_code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: classifications class_file_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classifications
    ADD CONSTRAINT class_file_code_unique UNIQUE (file_id, classification_code);


--
-- Name: classifications classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classifications
    ADD CONSTRAINT classifications_pkey PRIMARY KEY (id);


--
-- Name: document_exif document_exif_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exif
    ADD CONSTRAINT document_exif_document_id_key UNIQUE (document_id);


--
-- Name: document_exif document_exif_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exif
    ADD CONSTRAINT document_exif_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: influx_configs influx_configs_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influx_configs
    ADD CONSTRAINT influx_configs_file_id_key UNIQUE (file_id);


--
-- Name: influx_configs influx_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influx_configs
    ADD CONSTRAINT influx_configs_pkey PRIMARY KEY (id);


--
-- Name: kb_documents kb_documents_kb_document_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_kb_document_unique UNIQUE (kb_id, document_id);


--
-- Name: kb_documents kb_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_file_id_key UNIQUE (file_id);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: mapping_configs mapping_configs_file_id_config_type_field_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapping_configs
    ADD CONSTRAINT mapping_configs_file_id_config_type_field_name_key UNIQUE (file_id, config_type, field_name);


--
-- Name: mapping_configs mapping_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapping_configs
    ADD CONSTRAINT mapping_configs_pkey PRIMARY KEY (id);


--
-- Name: model_files model_files_file_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_files
    ADD CONSTRAINT model_files_file_code_key UNIQUE (file_code);


--
-- Name: model_files model_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_files
    ADD CONSTRAINT model_files_pkey PRIMARY KEY (id);


--
-- Name: spaces spaces_file_space_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_file_space_unique UNIQUE (file_id, space_code);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: asset_specs specs_file_spec_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_specs
    ADD CONSTRAINT specs_file_spec_unique UNIQUE (file_id, spec_code);


--
-- Name: system_config system_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_config_key_key UNIQUE (config_key);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- Name: views uq_views_file_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT uq_views_file_name UNIQUE (file_id, name);


--
-- Name: views views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_pkey PRIMARY KEY (id);


--
-- Name: idx_asset_specs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_specs_category ON public.asset_specs USING btree (category);


--
-- Name: idx_asset_specs_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_specs_classification ON public.asset_specs USING btree (classification_code);


--
-- Name: idx_asset_specs_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_specs_family ON public.asset_specs USING btree (family);


--
-- Name: idx_asset_specs_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_specs_file_id ON public.asset_specs USING btree (file_id);


--
-- Name: idx_asset_specs_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_specs_name ON public.asset_specs USING btree (spec_name);


--
-- Name: idx_asset_specs_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_asset_specs_uuid ON public.asset_specs USING btree (uuid);


--
-- Name: idx_assets_db_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_db_id ON public.assets USING btree (db_id);


--
-- Name: idx_assets_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_file_id ON public.assets USING btree (file_id);


--
-- Name: idx_assets_floor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_floor ON public.assets USING btree (floor);


--
-- Name: idx_assets_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_room ON public.assets USING btree (room);


--
-- Name: idx_assets_spec_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_spec_code ON public.assets USING btree (spec_code);


--
-- Name: idx_assets_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assets_uuid ON public.assets USING btree (uuid);


--
-- Name: idx_classifications_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classifications_code ON public.classifications USING btree (classification_code);


--
-- Name: idx_classifications_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classifications_file_id ON public.classifications USING btree (file_id);


--
-- Name: idx_classifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classifications_type ON public.classifications USING btree (classification_type);


--
-- Name: idx_document_exif_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_exif_date_time ON public.document_exif USING btree (date_time);


--
-- Name: idx_document_exif_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_exif_document_id ON public.document_exif USING btree (document_id);


--
-- Name: idx_documents_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_asset ON public.documents USING btree (asset_code);


--
-- Name: idx_documents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_created ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_space ON public.documents USING btree (space_code);


--
-- Name: idx_documents_spec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_spec ON public.documents USING btree (spec_code);


--
-- Name: idx_influx_configs_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_influx_configs_file_id ON public.influx_configs USING btree (file_id);


--
-- Name: idx_kb_documents_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_documents_document_id ON public.kb_documents USING btree (document_id);


--
-- Name: idx_kb_documents_kb_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_documents_kb_id ON public.kb_documents USING btree (kb_id);


--
-- Name: idx_kb_documents_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_documents_sync_status ON public.kb_documents USING btree (sync_status);


--
-- Name: idx_knowledge_bases_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_bases_file_id ON public.knowledge_bases USING btree (file_id);


--
-- Name: idx_mapping_configs_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mapping_configs_file_id ON public.mapping_configs USING btree (file_id);


--
-- Name: idx_mapping_configs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mapping_configs_type ON public.mapping_configs USING btree (config_type);


--
-- Name: idx_model_files_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_files_active ON public.model_files USING btree (is_active);


--
-- Name: idx_model_files_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_files_status ON public.model_files USING btree (status);


--
-- Name: idx_spaces_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_classification ON public.spaces USING btree (classification_code);


--
-- Name: idx_spaces_db_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_db_id ON public.spaces USING btree (db_id);


--
-- Name: idx_spaces_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_file_id ON public.spaces USING btree (file_id);


--
-- Name: idx_spaces_floor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_floor ON public.spaces USING btree (floor);


--
-- Name: idx_spaces_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_spaces_uuid ON public.spaces USING btree (uuid);


--
-- Name: idx_views_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_views_created ON public.views USING btree (created_at DESC);


--
-- Name: idx_views_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_views_file_id ON public.views USING btree (file_id);


--
-- Name: idx_views_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_views_name ON public.views USING btree (name);


--
-- Name: asset_specs update_asset_specs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_asset_specs_updated_at BEFORE UPDATE ON public.asset_specs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classifications update_classifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classifications_updated_at BEFORE UPDATE ON public.classifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: influx_configs update_influx_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_influx_configs_updated_at BEFORE UPDATE ON public.influx_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_bases update_knowledge_bases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON public.knowledge_bases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: model_files update_model_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_model_files_updated_at BEFORE UPDATE ON public.model_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: spaces update_spaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asset_specs asset_specs_file_id_fkey_cascade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_specs
    ADD CONSTRAINT asset_specs_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: assets assets_file_id_fkey_cascade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: document_exif document_exif_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_exif
    ADD CONSTRAINT document_exif_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_view_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id) ON DELETE SET NULL;


--
-- Name: mapping_configs fk_mapping_configs_model_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapping_configs
    ADD CONSTRAINT fk_mapping_configs_model_file FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: influx_configs influx_configs_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influx_configs
    ADD CONSTRAINT influx_configs_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: kb_documents kb_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: kb_documents kb_documents_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: knowledge_bases knowledge_bases_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: spaces spaces_file_id_fkey_cascade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- Name: views views_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.model_files(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict VMg9XP2QY1bVme6sAGGgQcjCmLEHMVbGiXaYySubz37O8fcuyHNd12dUuPj0z34

