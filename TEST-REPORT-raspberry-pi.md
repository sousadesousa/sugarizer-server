# Test report: `docker/raspberry-pi` @ 004e6a7

Tested commit: `004e6a75909b312dc7bfd4d69fba50e18c8d698e` (the follow-up commit, "Pi override: configurable Node heap, keep database bind mount, standalone image CI only on manual runs"). No Docker daemon and no Pi were available. Only `docker compose config`, static analysis, registry queries, lint and tests were run.

**Verdict: ready to merge, with two small doc fixes recommended (2 doc errors below, neither blocks).** Nothing here could prove that an image builds or that MongoDB starts on a Pi 5. The owner's Pi checklist and the first CI run of `multiarch` cover that.

| # | Check | Result |
|---|-------|--------|
| 1 | Only Docker/CI/docs files changed | PASS |
| 2 | Compose override resolves, defaults/overrides, data kept | PASS |
| 3 | Workflow | PASS |
| 4 | Image manifests have arm64 | PASS |
| 5 | `npm ci --ignore-scripts` in standalone | PASS (not run on arm64) |
| 6 | docs/raspberry-pi.md | PASS with 2 doc errors, 1 doubtful claim |
| 7 | lint and tests | PASS |

## 1. Diff vs origin/master: PASS
`git diff --name-status origin/master HEAD`:
```
M .github/workflows/docker.yml
M README.md
A REPORT-raspberry-pi.md
A docker-compose.pi.yml
M docker/Dockerfile-standalone
M docs/install.md
A docs/raspberry-pi.md
```
No application code. `docker-compose.yml` and `docker/Dockerfile` have no diff.

## 2. Compose: PASS
Ran `docker compose -f docker-compose.yml -f docker-compose.pi.yml config` (Compose v5.3.1):
- Resolves without errors.
- mongod command is `mongod --wiredTigerCacheSizeGB 1`. With `MONGO_CACHE_GB=2` the value changes (the grep showed the `--wiredTigerCacheSizeGB` line; I did not capture the "2" itself in the filtered output).
- `NODE_OPTIONS: --max-old-space-size=1024` by default. With `NODE_HEAP_MB=512` it becomes `--max-old-space-size=512`.
- `SUGARIZER_SECRET: ""` is kept next to `NODE_OPTIONS`, so the environment merges correctly.
- Both services have `restart: unless-stopped`.
- Both services have `json-file` logging with `max-size: 10m` and `max-file: "3"`.
- Database volume: mongodb keeps `type: bind`, source `<repo>/docker/db`, target `/data/db`. This is the same bind mount as the default file and there is no named volume. An existing install therefore sees the same directory and keeps its data. I confirmed this from the resolved config only, not from a running Mongo.
- `docker compose -f docker-compose.yml config` alone matches master. There is no file diff. I also resolved master's file from another directory, and the only differences were the four path lines that depend on the directory.
- The `x-logging` extension key appears at the end of the resolved output. This is harmless.

## 3. Workflow: PASS
Parsed with PyYAML. Jobs are `compose`, `multiarch` and `multiarch-standalone`. Triggers are `push`, `pull_request` and `workflow_dispatch`.
- `multiarch` runs on push and PR. It uses QEMU (`platforms: arm64`), buildx, and `build-push-action` with `file: docker/Dockerfile` and `platforms: linux/amd64,linux/arm64`.
- `multiarch-standalone` has `if: github.event_name == 'workflow_dispatch'`, so it runs only when started by hand.
- Both have `push: false` and no registry login, so nothing is pushed.
- Actions are on major versions: checkout@v4, setup-qemu@v3, setup-buildx@v3, build-push-action@v6. These are current majors; they are not pinned to SHAs, which matches the existing `compose` job.
- The `gha` cache scope is per Dockerfile.
- The `compose` job is unchanged.
- Not verified: the workflow was not run, so the arm64 build under QEMU is untested.

## 4. Manifests (Docker Hub registry API): PASS
- `node:22-bookworm-slim`: linux/amd64, linux/arm/v7, linux/arm64/v8, linux/ppc64le (plus attestation entries).
- `mongo:8.0`: linux/amd64, linux/arm64/v8 (plus windows amd64 and attestations).

Both have a linux/arm64 entry.

## 5. `npm ci --ignore-scripts` in the standalone build stage: PASS (not run on arm64)
- The server grunt build (`Gruntfile.js`) runs `terser`, `imagemin` and `cssmin`. These are pure JS except for the imagemin binaries.
- In `package-lock.json` the packages with install scripts are `esbuild` (dev), `fsevents` (dev, macOS only), `gifsicle`, `jpegtran-bin` and `optipng-bin`. All five are dev dependencies. `esbuild` is not used by the grunt tasks.
- `grunt-contrib-imagemin` is the only consumer of the three binary packages. With scripts skipped the binaries are missing, so imagemin fails. `grunt --force` carries on, and `cp -r build/*` still copies the terser/cssmin output. The original images stay in the repo, so only the optimisation (level 0 anyway) is lost. Nothing the client needs at build time depends on install scripts.
- The final `npm ci --omit=dev` runs with scripts. As far as I can tell no production package has an install script, so it is unaffected.
- The client stage (`npm ci && npx grunt` in `/opt/sugarizer`) is unchanged. Its devDependencies (`package.json` on master) include `canvas ^2.10.1`, which has an install script. If that does not install on arm64 the standalone build breaks regardless of this PR. This is the one risk I could not rule out, and it only affects the manual `multiarch-standalone` job. I did not try an arm64 install.

## 6. docs/raspberry-pi.md: PASS with doc errors
Followed step by step. These were fine:
- File names match the repo: `docker-compose.pi.yml` and `docker-compose.yml`; `add-admin.sh` is copied into the image by `COPY . .` and is not in `.dockerignore`; the workdir is `/sugarizer-server`.
- `add-admin.sh` usage is `<user> <password> <url>`, which the guide's command matches. The `/auth/signup` route exists.
- The DB name is `sugarizer` (`env/docker.ini`), so `mongodump --db sugarizer` is right.
- The `mongo:8.0` Dockerfile installs `mongodb-org-tools` and `database-tools-extra`, so `mongodump` and `mongorestore` exist in the image.
- The `--archive --gzip` options are valid, and `exec -T` is correct for redirects. `--drop` on restore is valid. I did not run any of them.
- The Pi 4 statement is accurate. MongoDB 5.0 and later need ARMv8.2-A on arm64; the Pi 4 is Cortex-A72 (ARMv8.0), and the Pi 5 is Cortex-A76 (ARMv8.2). This is from my knowledge of MongoDB's documented requirement. I could not open mongodb.com from this environment (blocked by the proxy), so I did not confirm it against their docs.
- Links: `README.md` links to `docs/raspberry-pi.md` and `docs/install.md` links to `raspberry-pi.md`. Both resolve.

Doc errors:
1. **Line 78** (Update section): `cd sugarizer && git pull && cd ../sugarizer-server`. The Install section ends inside `sugarizer-server`, where there is no `sugarizer` directory, so a reader who follows the guide gets `cd: sugarizer: No such file or directory`. The command only works from the parent directory. Use `git -C ../sugarizer pull` and `git pull`, or `cd ../sugarizer && git pull && cd ../sugarizer-server`.
2. **Line 82**: "The database volume is kept." is stale after the switch to the bind mount. Say "The `docker/db` directory is kept."

Doubtful claim:
3. **Line 12**: "The last MongoDB version that runs on a Pi 4 is 4.4." I believe 4.4.19 and later also need ARMv8.2-A, so `mongo:4.4` would crash on a Pi 4 as well. Suggest "4.4.18 or earlier, or ask a MongoDB-compatible fork". I could not check this here. Either check it or drop the sentence; the guide does not support Pi 4 in any case.

Smaller points (optional):
- The `COMPOSE_FILE` hint on line 45 works, but an explicit `-f` overrides it. The guide's own commands all use `-f`, so that is fine.
- Troubleshooting line 87 says an Illegal instruction means "not a Pi 5". Other ARMv8.0 boards also crash, so "an older CPU than a Pi 5" is closer.

## 7. Lint and tests: PASS
- `npm run lint`: 0 errors, 1 warning (`api/route.js:15`, unused eslint-disable directive; it also appears on master, so it is not from this branch).
- `npm test` with mongod 8.0.23 (conda-forge, extracted locally) and `../sugarizer` cloned from sousadesousa/sugarizer: **168 passing**.

## Left for the owner's Pi 5 checklist (cannot be shown here)
All items in `REPORT-raspberry-pi.md`, "Manual checklist for the Pi 5", plus:
- The first CI run of `multiarch` (arm64 under QEMU) and, if wanted, a manual `workflow_dispatch` run of `multiarch-standalone` (the `canvas` and `--ignore-scripts` risks above).
- That `mongo:8.0` starts on the Pi 5. Please also check the kernel page size: Pi OS Bookworm ships a 16 KB-page kernel on the Pi 5, and older MongoDB builds had trouble with that. If mongod crashes at startup, try `kernel=kernel8.img` in `config.txt`. I have not verified whether 8.0 is affected.
- Memory with the 1024 MB heap and a 1 GB WiredTiger cache on a 4 GB board under load.
- Restart after reboot, log rotation (`docker inspect`), and an actual `mongodump`/`mongorestore` round trip.
- Adding `-f docker-compose.pi.yml` to an install that already has data in `docker/db`: check that users and journal entries are still there.
