# Sugarizer Server on a Raspberry Pi 5

This guide runs Sugarizer Server and MongoDB in Docker on a Raspberry Pi 5, for example as a classroom server.

## Requirements

- **Raspberry Pi 5**, 4 GB of RAM or more (8 GB is comfortable for a large classroom).
- **64-bit Raspberry Pi OS** (Bookworm or later). The 32-bit OS does not work: MongoDB has no 32-bit builds.
- An **SSD** (USB 3 or NVMe) is strongly recommended over an SD card. MongoDB writes constantly and SD cards are slow and wear out.
- A wired network connection for a server used by many students.

Raspberry Pi 4 and older are **not supported**: MongoDB 5 and later need a CPU with ARMv8.2 instructions (the Pi 5 has them, the Pi 4 does not) and the `mongo:8.0` image used here will crash on startup (`Illegal instruction`). Only old MongoDB releases run on a Pi 4 (recent 4.4 releases need ARMv8.2 too); they are end of life and receive no security fixes, so running Sugarizer Server on a Pi 4 is **unsupported and not recommended**.

Check your system with `uname -m` (must print `aarch64`).

## Install

1. Install Docker (includes the Compose plugin):

		curl -fsSL https://get.docker.com | sh
		sudo usermod -aG docker $USER

	Log out and in again so the group change applies.

2. Clone the client and the server side by side (the compose file mounts `../sugarizer`):

		git clone https://github.com/sousadesousa/sugarizer
		git clone https://github.com/sousadesousa/sugarizer-server
		cd sugarizer-server

3. Set a fixed secret, so users stay logged in when containers are recreated:

		echo "SUGARIZER_SECRET=$(openssl rand -base64 48)" > .env

	On an 8 GB Pi you can also give MongoDB a larger cache with `echo "MONGO_CACHE_GB=2" >> .env` (default is 1).

	The Node.js heap limit of the server is `NODE_HEAP_MB` (default 1024). On a 2 GB Pi use `echo "NODE_HEAP_MB=512" >> .env` (and `MONGO_CACHE_GB=0.5`).

4. Build and start (the first build takes a few minutes on a Pi):

		docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build

	`docker-compose.pi.yml` adds on top of the default configuration: a MongoDB cache limit (`--wiredTigerCacheSizeGB`), `restart: unless-stopped` so Sugarizer starts again after a reboot, log rotation (3 files of 10 MB per container) so logs do not fill the disk, and a Node.js heap limit. The database stays in `./docker/db`, exactly as with the default `docker-compose.yml`.

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

The database is in the `docker/db` directory of the server, the same place as with the default `docker-compose.yml`. **Switching an existing install to the Pi override keeps its data**: the override deliberately does not move the database to a Docker named volume, as a new volume would be empty and an existing install would look like it lost all its users and journal entries. You can add `-f docker-compose.pi.yml` to a running stack without migrating anything.

Make a dump with:

	docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T mongodb mongodump --archive --gzip --db sugarizer > sugarizer-$(date +%F).archive.gz

Restore (on a running stack) with:

	docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T mongodb mongorestore --archive --gzip --drop < sugarizer-2025-01-01.archive.gz

Copy the dump off the Pi (another disk or computer). Keep also the `.env` file, it holds the secret.

## Update

	git -C ../sugarizer pull
	git pull
	docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build

Run these commands from the `sugarizer-server` directory. The `docker/db` directory (the database) is kept. Read the [Migration guide](migrate.md) when upgrading across major versions, and make a backup first. To follow Docker image updates of MongoDB, run `docker compose ... pull mongodb` then `up -d`.

## Troubleshooting

- `docker compose logs -f server` / `logs -f mongodb` show the logs.
- MongoDB restarting with `Illegal instruction`: the CPU is older than the Pi 5's (ARMv8.2 is needed, see Requirements).
- MongoDB crashing at startup on a Pi 5 with a memory or page size error: Raspberry Pi OS on the Pi 5 uses a kernel with 16 KB memory pages by default, which some MongoDB builds do not handle. Switch to the 4 KB page kernel by adding `kernel=kernel8.img` to `/boot/firmware/config.txt`, then reboot (`getconf PAGESIZE` prints `4096` afterwards).
- Out-of-memory kills on a 4 GB Pi: lower `MONGO_CACHE_GB` (e.g. `0.5`) and `NODE_HEAP_MB` (e.g. `512`) and check `docker stats`.
- `JavaScript heap out of memory` in the server logs (for example on a big CSV import): raise `NODE_HEAP_MB` (e.g. `2048` on an 8 GB Pi).
