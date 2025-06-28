-- =============================================
-- Citrus Host Database Schema - Fresh Install
-- =============================================
-- This file creates a complete database schema for fresh installations
-- Generated: 2025-01-26

-- Set PostgreSQL configuration
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function to update agents updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_agents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Function to update servers updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_servers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =============================================
-- TABLES
-- =============================================

-- Users table - Core authentication and user management
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan prices table - Subscription plan definitions
CREATE TABLE public.plan_prices (
    id SERIAL PRIMARY KEY,
    plan_type VARCHAR(100) UNIQUE NOT NULL,
    price_id VARCHAR(255) NOT NULL,
    description TEXT,
    amount NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan addons table - Additional services for plans
CREATE TABLE public.plan_addons (
    id SERIAL PRIMARY KEY,
    base_plan_id INTEGER NOT NULL,
    addon_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_id VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (base_plan_id) REFERENCES public.plan_prices(id) ON DELETE CASCADE
);

-- Server types table - Defines different server configurations
CREATE TABLE public.server_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    size VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    max_sites INTEGER DEFAULT 2 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subscription_plan_type VARCHAR(100)
);

-- Agents table - Server management agents
CREATE TABLE public.agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key VARCHAR(128) UNIQUE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'offline' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    git_version VARCHAR(40),
    service_status JSONB,
    CONSTRAINT agents_status_check CHECK (status IN ('online', 'offline', 'error'))
);

-- Servers table - Physical/virtual server instances
CREATE TABLE public.servers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    digital_ocean_id VARCHAR(255),
    region VARCHAR(50) NOT NULL,
    size VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    status VARCHAR(50) DEFAULT 'creating' NOT NULL,
    agent_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    max_sites INTEGER DEFAULT 2 NOT NULL,
    active_sites INTEGER DEFAULT 0 NOT NULL,
    server_type_id UUID,
    owner INTEGER,
    is_restored_backup BOOLEAN DEFAULT false NOT NULL,
    original_server_id UUID,
    stripe_subscription_id VARCHAR(255),
    FOREIGN KEY (agent_id) REFERENCES public.agents(id),
    FOREIGN KEY (server_type_id) REFERENCES public.server_types(id),
    FOREIGN KEY (owner) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Sites table - Individual websites hosted on servers
CREATE TABLE public.sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255),
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deployer_id VARCHAR(255),
    deploy_status VARCHAR(50) DEFAULT 'pending',
    last_deploy_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_id UUID,
    ssl_status VARCHAR DEFAULT 'inactive',
    FOREIGN KEY (user_id) REFERENCES public.users(id),
    FOREIGN KEY (server_id) REFERENCES public.servers(id)
);

-- Subscriptions table - User subscription management
CREATE TABLE public.subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_subscription_id VARCHAR(255) NOT NULL,
    plan_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_id UUID,
    subscription_item_id VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Pending operations table - Retry mechanism for failed operations
CREATE TABLE public.pending_operations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

-- =============================================
-- INDEXES
-- =============================================

-- Agents indexes
CREATE INDEX idx_agents_git_version ON public.agents USING btree (git_version);
CREATE INDEX idx_agents_service_status ON public.agents USING gin (service_status);

-- Servers indexes
CREATE INDEX idx_servers_agent_id ON public.servers USING btree (agent_id);
CREATE INDEX idx_servers_digital_ocean_id ON public.servers USING btree (digital_ocean_id);
CREATE INDEX idx_servers_is_restored_backup ON public.servers USING btree (is_restored_backup);
CREATE INDEX idx_servers_original_server_id ON public.servers USING btree (original_server_id);
CREATE INDEX idx_servers_owner ON public.servers USING btree (owner);
CREATE INDEX idx_servers_status ON public.servers USING btree (status);
CREATE INDEX idx_servers_stripe_subscription_id ON public.servers USING btree (stripe_subscription_id);

-- Sites indexes
CREATE INDEX idx_sites_server_id ON public.sites USING btree (server_id);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_item_id ON public.subscriptions USING btree (subscription_item_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions USING btree (stripe_subscription_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);

-- Plan addons indexes
CREATE INDEX idx_plan_addons_available ON public.plan_addons USING btree (is_available);
CREATE INDEX idx_plan_addons_base_plan ON public.plan_addons USING btree (base_plan_id);
CREATE INDEX idx_plan_addons_type ON public.plan_addons USING btree (addon_type);

-- Pending operations indexes
CREATE INDEX idx_pending_operations_domain ON public.pending_operations USING btree (domain);
CREATE INDEX idx_pending_operations_site_id ON public.pending_operations USING btree (site_id);
CREATE INDEX idx_pending_operations_status ON public.pending_operations USING btree (status);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamp triggers
CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON public.agents 
    FOR EACH ROW EXECUTE FUNCTION public.update_agents_updated_at();

CREATE TRIGGER update_server_types_updated_at 
    BEFORE UPDATE ON public.server_types 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_servers_updated_at 
    BEFORE UPDATE ON public.servers 
    FOR EACH ROW EXECUTE FUNCTION public.update_servers_updated_at();

-- =============================================
-- COMMENTS
-- =============================================

-- Table comments
COMMENT ON TABLE public.sites IS 'Sites table - backup status is determined from subscriptions table, not stored here';
COMMENT ON TABLE public.pending_operations IS 'Tracks operations that need to be retried if connections are lost';

-- Column comments
COMMENT ON COLUMN public.sites.ssl_status IS 'Status of SSL for the site (active, inactive, pending, error)';
COMMENT ON COLUMN public.servers.original_server_id IS 'The ID of the original server that this backup was created from.';
COMMENT ON COLUMN public.pending_operations.operation_type IS 'Type of operation: deploy_ssl, turn_off_ssl, redeploy_ssl, create, delete';
COMMENT ON COLUMN public.pending_operations.status IS 'Status of the retry: pending, completed, failed, retried';
COMMENT ON COLUMN public.pending_operations.retry_count IS 'Number of times this operation has been retried';
COMMENT ON COLUMN public.pending_operations.last_retry_at IS 'Timestamp of the last retry attempt';

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Insert default admin user
INSERT INTO public.users (id, name, email, password, is_admin, stripe_customer_id, created_at) 
VALUES (1, 'Admin', 'admin@citrushost.io', '$2b$10$YpVDyQgfX5rIuhSakJCf9OPXq0mczUkDZ4iHnq/U.sxUfwUpFK8DK', true, NULL, '2025-04-28T02:23:07.463Z')
ON CONFLICT (email) DO NOTHING;

-- Insert default plan prices
INSERT INTO public.plan_prices (id, plan_type, price_id, description, amount, created_at) VALUES
(10, 'standard', 'price_1RUKEIDBpWxtVXcSousr5FzC', 'Standard Server - 1GB RAM, 1 CPU', 5.00, '2025-05-25 04:59:12.622107'),
(11, 'performance', 'price_1RUKESDBpWxtVXcS50TUgHIB', 'Performance Server - 4GB RAM, 2 CPU', 15.00, '2025-05-25 04:59:12.622107'),
(12, 'scale', 'price_1RUKEcDBpWxtVXcSPv1EefFk', 'Scale Server - 8GB RAM, 4 CPU', 30.00, '2025-05-25 04:59:12.622107')
ON CONFLICT (plan_type) DO NOTHING;

-- Insert default plan addons
INSERT INTO public.plan_addons (id, base_plan_id, addon_type, name, description, price_id, amount, is_available, created_at) VALUES
(1, 10, 'backup', 'Standard Backup', 'Standard Backup Service - Daily backups with 30-day retention', 'price_1RW7XEDBpWxtVXcSok0SYacI', 15.00, true, '2025-06-04 08:46:15.397'),
(2, 11, 'backup', 'Performance Backup', 'Performance Backup Service - Daily backups with 30-day retention', 'price_1RWVgXDBpWxtVXcSelN5O8D7', 30.00, true, '2025-06-04 08:46:15.397'),
(3, 12, 'backup', 'Scale Backup', 'Scale Backup Service - Daily backups with 30-day retention', 'price_1RWVgqDBpWxtVXcS8ZCnXIzp', 45.00, true, '2025-06-04 08:46:15.397')
ON CONFLICT DO NOTHING;

-- Insert default server types
INSERT INTO public.server_types (id, name, size, region, max_sites, created_at, updated_at, subscription_plan_type) VALUES
('50562cb9-68cb-2f2c-d2b8-9f7f5ea238fb', 'Standard', 's-1vcpu-1gb', 'sfo3', 1, '2025-05-10 21:27:04.085+00', '2025-05-25 05:03:06.933574+00', 'standard'),
('50ca98a7-9c3d-44dd-aa59-d7b2e604ca2d', 'Performance', 's-1vcpu-2gb', 'sfo3', 1, '2025-05-20 04:56:51.171+00', '2025-05-25 05:03:06.913664+00', 'performance'),
('57d17b8f-28b4-4b57-af15-e0024269ae85', 'Scale', 's-2vcpu-2gb', 'sfo3', 1, '2025-05-20 04:56:51.171+00', '2025-06-03 17:57:31.518814+00', 'scale')
ON CONFLICT (name) DO NOTHING;

-- Set sequence values to safe starting points
SELECT setval('public.users_id_seq', 100, false);
SELECT setval('public.plan_prices_id_seq', 50, false);
SELECT setval('public.plan_addons_id_seq', 10, false);
SELECT setval('public.sites_id_seq', 1, false);
SELECT setval('public.subscriptions_id_seq', 1, false);
SELECT setval('public.pending_operations_id_seq', 1, false);

-- =============================================
-- VERIFICATION
-- =============================================

DO $$
DECLARE
    user_count INTEGER;
    plan_count INTEGER;
    server_type_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.users WHERE is_admin = true;
    SELECT COUNT(*) INTO plan_count FROM public.plan_prices;
    SELECT COUNT(*) INTO server_type_count FROM public.server_types;
    
    RAISE NOTICE 'Schema installation completed successfully!';
    RAISE NOTICE 'Admin users: %', user_count;
    RAISE NOTICE 'Plan types: %', plan_count;
    RAISE NOTICE 'Server types: %', server_type_count;
    
    IF user_count = 0 THEN
        RAISE EXCEPTION 'No admin user found - installation may have failed';
    END IF;
END $$; 