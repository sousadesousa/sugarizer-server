# Sugarizer Server on a Raspberry Pi 5

This guide runs Sugarizer Server and MongoDB in Docker on a Raspberry Pi 5, for example as a classroom server.

## Requirements

- **Raspberry Pi 5**, 4 GB of RAM or more (8 GB is comfortable for a large classroom).
- **64-bit Raspberry Pi OS** (Bookworm or later). The 32-bit OS does not work: MongoDB has no 32-bit builds.
- An **SSD** (USB 3 or NVMe) is strongly recommended over an SD card. MongoDB writes constantly and SD cards are slow and wear out.
- A wired network connection for a server used by many students.

Raspberry Pi 4 and older are **not supported**: MongoDB 5 and later need a CPU with ARMv8.2 instructions (the Pi 5 has them, the Pi 4 does not) and the `mongo:8.0` image used here will crash on startup (`Illegal instruction`). The last MongoDB version that runs on a Pi 4 is 4.4. You could pin `mongo:4.4` in the compose file, but 4.4 is end of life and receives no security fixes, so this is **unsupported and not recommended**, and you should not expose such a server to the Internet.

Check your system with `uname -m` (must print `aarch64`).

## Install

1. Install Docker (includes the Compose plugin; Compose 2.24 or later is required):

		curl -fsSL https://get.docker.com | sh
		sudo usermod -aG docker $USER

	Log out and in again so the group change applies.

2. Clone the client and the server side by side (the compose file mounts `../sugarizer`):

		git clone https://github.com/llaske/sugarizer
		git clone https://github.com/llaske/sugarizer-server
		cd sugarizer-server

3. Set a fixed secret, so users stay logged in when containers are recreated:

		echo "SUGARIZER_SECRET=$(openssl rand -base64 48)" > .env

	On an 8 GB Pi you can also give MongoDB a larger cache with `echo "MONGO_CACHE_GB=2" >> .env` (default is 1).

4. Build and start (the first build takes a few minutes on a Pi):

		docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build

	`docker-compose.pi.yml` adds on top of the default configuration: a MongoDB cache limit (`--wiredTigerCacheSizeGB`), `restart: unless-stopped` so Sugarizer starts again after a reboot, log rotation (3 files of 10 MB per container) so logs do not fill the disk, and the database in a named volume (`sugarizer-db`).

	To avoid typing the two `-f` options each time, add `COMPOSE_FILE=docker-compose.yml:docker-compose.pi.yml` to the `.env` file.

5. Check that everything is running (`healthy` after about a minute):

		docker compose -f docker-compose.yml -f docker-compose.pi.yml ps

6. Create the administrator account (run inside the container, as the script must be launched from the server itself):

		docker compose -f docker-compose.yml -f docker-compose.pi.yml exec server sh add-admin.sh admin MyPassword http://127.0.0.1:8080/auth/signup

7. Open, from any computer on the network (replace `PI_ADDRESS` by the address or name of the Pi, e.g. `raspberrypi.local`):

	- the Sugarizer client: `http://PI_ADDRESS:8080`
	- the dashboard: `http://PI_ADDRESS:8080/dashboard`

	Collaboration (presence) uses port 8039: allow 8080 and 8039 if you use a firewall.

## Backup and restore

The database is in the Docker volume `sugarizer-server_sugarizer-db`. Make a dump with:

	docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T mongodb mongodump --archive --gzip --db sugarizer > sugarizer-$(date +%F).archive.gz

Restore (on a running stack) with:

	docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T mongodb mongorestore --archive --gzip --drop < sugarizer-2025-01-01.archive.gz

Copy the dump off the Pi (another disk or computer). Keep also the `.env` file, it holds the secret.

## Update

	cd sugarizer && git pull && cd ../sugarizer-server
	git pull
	docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build

The database volume is kept. Read the [Migration guide](migrate.md) when upgrading across major versions, and make a backup first. To follow Docker image updates of MongoDB, run `docker compose ... pull mongodb` then `up -d`.

## Troubleshooting

- `docker compose logs -f server` / `logs -f mongodb` show the logs.
- MongoDB restarting with `Illegal instruction`: the CPU is not a Pi 5 (see Requirements).
- Out-of-memory kills on a 4 GB Pi: lower `MONGO_CACHE_GB` (e.g. `0.5`) and check `docker stats`.
