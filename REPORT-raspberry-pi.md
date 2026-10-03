# Report: Raspberry Pi 5 support (branch `docker/raspberry-pi`)

## Changes
- `docker-compose.pi.yml` (new): override with MongoDB `--wiredTigerCacheSizeGB ${MONGO_CACHE_GB:-1}`, `restart: unless-stopped`, json-file log rotation (10 MB x 3) on both services, named volume `sugarizer-db` (replaces the `./docker/db` bind mount via `!override`, needs Compose >= 2.24), `NODE_OPTIONS=--max-old-space-size=512` for the server. Default `docker-compose.yml` is untouched.
- `.github/workflows/docker.yml`: new `multiarch` job (QEMU + buildx, `linux/amd64,linux/arm64`, `push: false`, matrix over `docker/Dockerfile` and `docker/Dockerfile-standalone`, gha cache). The existing workflow never pushed images, so this is build-only. The existing `compose` job is unchanged. `test.yml` not touched.
- `docker/Dockerfile-standalone`: the server build stage now uses `npm ci --ignore-scripts` (see below).
- `docs/raspberry-pi.md` (new), linked from `README.md` and `docs/install.md`. `docs/install.md` used to say "Raspberry Pi 4 or 5": corrected (Pi 4 cannot run MongoDB 8).
- No application code changed.

## Verified
- **Registry manifests** (Docker Hub registry API, manifest lists): `node:22-bookworm-slim` -> linux/amd64, arm64/v8, arm/v7, ppc64le. `mongo:8.0` -> linux/amd64, arm64/v8 (+ windows). Both have arm64. `Dockerfile-standalone` uses only `node:22-bookworm-slim`.
- **Native modules**: `npm ci --omit=dev`: no `binding.gyp`, no `.node` files, no prod package with an install script. The production image therefore needs no build tools on arm64.
- **Dev-only natives** (used by the standalone build stage, which installs devDependencies): `gifsicle`, `jpegtran-bin`, `optipng-bin` (grunt imagemin) download x86-64 binaries; on arm64 they compile from source (autoreconf/make) and `gifsicle`'s installer does `process.exit(1)` on failure, which would break `npm ci` on a Pi. Fix: `--ignore-scripts` for that step. Image optimization is then skipped, which the existing `grunt --force` already tolerated; terser/cssmin still run. The client's devDependencies (checked on GitHub, package.json) have no such natives. Not run end to end for arm64 (see below). The final `npm ci --omit=dev` in the same step is unaffected.
- **YAML**: workflow parsed with PyYAML (jobs `compose`, `multiarch`). Compose files validated with the real `docker compose -f docker-compose.yml -f docker-compose.pi.yml config` (Compose v5.3.1 CLI is present, daemon is not): resolved cleanly; mongod command, restart, logging, named volume `sugarizer-server_sugarizer-db` replacing the bind mount, env merge (`NODE_OPTIONS` + `SUGARIZER_SECRET`) all as intended. `docker-compose.yml` has no diff.
- `npm run lint`: 0 errors, 1 pre-existing warning (unused eslint-disable directive). `npm test` with mongod 8.0.23 and `../sugarizer`: 168 passing.

## NOT verified (needs Docker and/or a real Pi)
- No image was built or run here (no daemon): the multi-arch build, the `--ignore-scripts` effect on arm64, and the QEMU build time (timeout set to 60 min, unmeasured) are untested. The `multiarch` CI job will be the first real check.
- That `mongo:8.0` actually starts on a Pi 5, WiredTiger cache sizing, memory use with `NODE_OPTIONS=--max-old-space-size=512` (large CSV imports on a 4 GB Pi could need more; raise if you see heap errors), SD/SSD behavior, log rotation, and restart after reboot.
- The `mongodump`/`mongorestore` commands in the docs, and `COMPOSE_FILE` in `.env` (standard Compose feature) were not executed.
- ARMv8.2 requirement for Pi 5 vs Pi 4 is from MongoDB's documented requirements, not checked on hardware.
- 64-bit OS guidance for Docker Compose >= 2.24 (`get.docker.com` installs current).

## Manual checklist for the Pi 5
1. `uname -m` prints `aarch64`; `curl -fsSL https://get.docker.com | sh`; `docker compose version` >= 2.24.
2. Clone `sugarizer` and `sugarizer-server` side by side; create `.env` with `SUGARIZER_SECRET`.
3. `docker compose -f docker-compose.yml -f docker-compose.pi.yml up -d --build`; `ps` shows both services `healthy`.
4. `docker compose ... config | grep -A3 wiredTiger` shows the cache value; `docker inspect <mongo container> --format '{{.HostConfig.LogConfig}}'` shows json-file max-size 10m.
5. Create the admin with `add-admin.sh` in the container; log in to `http://PI:8080/dashboard`; open the client at `http://PI:8080` from another machine, sign up a user, save a Journal entry.
6. `sudo reboot`: both containers come back by themselves; the user and journal entry are still there.
7. Run the `mongodump` command from the guide, check the file is non-empty; try a restore on a test stack.
8. `docker stats` under load (several browsers): memory stays well under total RAM.
9. Optional: build the standalone image on the Pi: `docker build -f docker/Dockerfile-standalone -t sugarizer .`.

## Questions for the owner
- Keep the `NODE_OPTIONS=--max-old-space-size=512` limit in the Pi override? It protects 4 GB boards but may be too tight for big imports.
- The `multiarch` job also builds the standalone image under QEMU (slow, clones from GitHub master, not this branch). Drop that matrix entry if CI time matters.
