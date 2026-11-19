# BUILDsmore — Luxury Real Estate Platform

BUILDsmore is an international luxury real estate platform and automated multi-source portfolio management system. It unifies high-net-worth property acquisitions across ~60 European and Middle Eastern agency portals into a single verified, deduplicated registry.

---

## 1. System Architecture

- **Frontend**: React 19 SPA powered by Vite, Tailwind CSS v4, Lucide icons, Motion, and custom luxury typography (Cormorant Garamond & Plus Jakarta Sans).
- **Backend & APIs**: Express 4.21 / Node.js 22 LTS with full REST endpoints for property CRUD, lead ingestion, and WordPress synchronization.
- **Relational Database**: PostgreSQL 16 schema managed via Drizzle ORM (`src/db/schema.ts`, `src/db/migrations/0001_initial_schema.sql`).
- **Background Worker & Queues**: Redis 7 and BullMQ for scheduled multi-site crawling and asset ingestion.
- **Media Ingestion**: S3-compatible object storage for high-resolution property photography.
- **Reverse Proxy**: Nginx 1.27 with TLS termination and gzip compression.

---

## 2. Server-Side Environment Variables

The server validates the presence and security of 10 required environment variables at startup. Sensitive credentials are never exposed to frontend code and are strictly masked in server logs (e.g., `secr****ab`).

| Variable Name | Description | Example / Local Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 16 connection URI | `postgresql://buildsmore_admin:LuxurySecured2026@localhost:5432/buildsmore_db?sslmode=disable` |
| `REDIS_URL` | Redis 7 connection URI (BullMQ queue) | `redis://localhost:6379` |
| `S3_ENDPOINT` | S3 API endpoint (AWS, Cloudflare R2, MinIO) | `https://s3.eu-central-1.amazonaws.com` |
| `S3_BUCKET` | Destination S3 bucket name | `buildsmore-properties-media` |
| `S3_REGION` | Cloud storage region | `eu-central-1` |
| `S3_ACCESS_KEY_ID` | S3 API key ID | Configured via environment |
| `S3_SECRET_ACCESS_KEY` | S3 API secret access key | Configured via environment |
| `ADMIN_INITIAL_EMAIL` | First administrator email address | `director@buildsmore.com` |
| `ADMIN_INITIAL_PASSWORD` | First administrator initial password (min 8 chars) | `buildsmore2026!` |
| `JWT_SECRET` | Cryptographic secret for signing tokens (min 32 chars) | 64-character high-entropy secret |

> **Security Rule**: `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` are used **only** on first setup when no administrator accounts exist in the database. When an administrator already exists, the server strictly preserves existing credentials and will **never reset passwords on restart**.

---

## 3. Windows Local Setup Instructions

### Prerequisites
1. **Node.js**: Install Node.js 22 LTS (includes npm) from [nodejs.org](https://nodejs.org).
2. **Git**: Install Git for Windows from [gitforwindows.org](https://gitforwindows.org).
3. **Docker Desktop** (Recommended): Install Docker Desktop for Windows with WSL2 backend from [docker.com](https://www.docker.com/products/docker-desktop).
   *(Alternatively, you can install native Windows services for PostgreSQL 16 and Redis 7).*

### Step 1: Clone Repository & Open PowerShell / CMD
Open PowerShell (as regular user or Administrator):
```powershell
git clone https://github.com/your-org/buildsmore.git
cd buildsmore
```

### Step 2: Configure Environment Variables
Copy the template to create your `.env` configuration file:
```powershell
# PowerShell
Copy-Item .env.example .env

# Or Windows Command Prompt (cmd.exe)
copy .env.example .env
```
Open `.env` in VS Code or Notepad:
```powershell
notepad .env
```
Ensure all variables are populated with your desired credentials. The file is automatically ignored by `.gitignore` to prevent credential exposure.

### Step 3: Install Dependencies
```powershell
npm install
```

### Step 4: Start PostgreSQL & Redis on Windows
Using Docker Compose:
```powershell
docker compose up -d postgres redis
```
Verify containers are healthy:
```powershell
docker compose ps
```

### Step 5: Run Database Migrations
Apply the PostgreSQL DDL schema (creates `administrators`, `source_websites`, `properties`, `property_images`, `inquiries`, `import_jobs`, and `audit_logs` tables):
```powershell
npm run db:migrate
```

### Step 6: Run Verification Tests
Verify all 19 platform, security, and environment integration tests:
```powershell
npm run test
```

### Step 7: Launch the Application
```powershell
npm run dev
```
The server will initialize on `http://localhost:3000`. Open your browser to explore the public luxury real estate experience or visit `/portal` to access the administrative dashboard.

---

## 4. Administrative Access & Credentials

- **Portal URL**: `http://localhost:3000` -> Click **"Portal"** or **"Admin Console"** in the top navigation bar.
- **Managing Director Email**: `director@buildsmore.com` (or value of `ADMIN_INITIAL_EMAIL`)
- **Passkey**: `buildsmore2026!` (or value of `ADMIN_INITIAL_PASSWORD`)
- Direct phone inquiries: **9779878303**

---

## 5. Production Setup: Docker Compose & Ubuntu 24.04 LTS

### Option A: Complete Docker Compose Stack

The included `docker-compose.yml` configures the complete production topology:
- **`app`**: Node.js 22 LTS container running `server.ts` Express + Vite production bundle.
- **`postgres`**: PostgreSQL 16 Alpine container with automatic migration seeding and health checks.
- **`redis`**: Redis 7 Alpine container for BullMQ asynchronous import pipelines.
- **`nginx`**: Reverse proxy with gzip, asset caching, and HTTP/HTTPS forwarding.

Launch the full production stack:
```bash
docker compose up -d --build
```
Check service status and container logs:
```bash
docker compose ps
docker compose logs -f app
```

---

### Option B: Native Ubuntu 24.04 LTS Server Deployment

#### 1. System Updates & Node.js 22 LTS
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx certbot python3-certbot-nginx
node -v # Should display v22.x
```

#### 2. Install PostgreSQL 16 & Redis 7
```bash
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable --now postgresql redis-server

# Create database and user
sudo -u postgres psql -c "CREATE USER buildsmore_admin WITH ENCRYPTED PASSWORD 'YourStrongProductionPassword';"
sudo -u postgres psql -c "CREATE DATABASE buildsmore_db OWNER buildsmore_admin;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE buildsmore_db TO buildsmore_admin;"
```

#### 3. Deploy Code & Install Packages
```bash
sudo mkdir -p /var/www/buildsmore
sudo chown -R $USER:$USER /var/www/buildsmore
cd /var/www/buildsmore
git clone https://github.com/your-org/buildsmore.git .
npm ci
cp .env.example .env
nano .env # Set production DATABASE_URL, S3 keys, and JWT_SECRET
```

#### 4. Run Migrations & Build
```bash
npm run db:migrate
npm run build
npm run test
```

#### 5. Configure Systemd Service (`/etc/systemd/system/buildsmore.service`)
```ini
[Unit]
Description=BUILDsmore Luxury Real Estate Application
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/buildsmore
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
EnvironmentFile=/var/www/buildsmore/.env

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo chown -R www-data:www-data /var/www/buildsmore
sudo systemctl daemon-reload
sudo systemctl enable --now buildsmore
sudo systemctl status buildsmore
```

#### 6. Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/buildsmore`)
```nginx
server {
    listen 80;
    server_name buildsmore.com www.buildsmore.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 25M;
    }
}
```
Enable the site and obtain SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/buildsmore /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d buildsmore.com -d www.buildsmore.com
```

---

## 6. WordPress Migration Engine (~60 Sites Scale)

BUILDsmore features an enterprise extraction adapter designed to synchronize over 60 WordPress sites:

1. **WordPress REST API**: Handshakes with `/wp-json/wp/v2/properties` or `/wp-json/wp/v2/posts`.
2. **ACF & Custom Meta**: Configurable field mapping schema (`fieldMapping` in `WordPressSource`) allowing arbitrary meta fields (e.g., `meta.property_price_eur`, `acf.asking_price_chf`).
3. **Page-Builder Fallback Adapter**: For Elementor/Divi sites where properties are embedded in raw HTML post content, an integrated heuristic engine parses prices, bedrooms, and surface areas directly.
4. **Duplicate Prevention**: Matches against `sourceWebsiteId + sourcePropertyId` or title/slug hash. Identical listings are skipped; revisions trigger a diff preview.
5. **Safe Central Policy**: With `preserve_central` enabled, central listings are never automatically deleted if missing on remote sources unless an explicit administrator policy is configured.
6. **Dry-Run Mode**: Inspect new records, field differences, and validation errors prior to database writes.

---

## 7. CSV Import & Export (RFC 4180 / Excel)

- **Export**: Exports all properties or filtered sets with UTF-8 Byte Order Mark (`\uFEFF`) so special characters (currency symbols, accents) render natively in Microsoft Excel.
- **Import**: Supports drag-and-drop CSV files with dry-run verification, duplicate detection, and schema validation.
- **Sample Template**: Downloadable directly from the admin CSV workspace.

---

## 8. Backup & Disaster Recovery

- **PostgreSQL Database Backup**:
  ```bash
  docker compose exec -t postgres pg_dump -U buildsmore_admin buildsmore_db > backup_$(date +%Y%m%d).sql
  ```
- **PostgreSQL Database Restore**:
  ```bash
  cat backup_file.sql | docker compose exec -i postgres psql -U buildsmore_admin -d buildsmore_db
  ```
