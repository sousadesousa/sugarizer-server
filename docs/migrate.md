# Migration guide

This documentation describes migration process to a recent Sugarizer Server version.

## Migrate to the next version (unreleased)
Sugarizer Server now requires Node.js 20+ and MongoDB 4.0+ (MongoDB 8.0 is recommended: older MongoDB versions no longer get security fixes).

If you run Sugarizer Server on your computer, update Node.js first, then run `npm install` again in the Sugarizer Server directory.

MongoDB cannot skip major versions when it upgrades existing data files (for example 5.0 to 6.0, then 6.0 to 7.0, then 7.0 to 8.0, setting `featureCompatibilityVersion` after each step), so the simplest way is to dump the database with your current MongoDB, install MongoDB 8.0 and restore the dump:

```
mongodump --db sugarizer --out sugarizer-dump
# install MongoDB 8.0, start it, then
mongorestore --db sugarizer sugarizer-dump/sugarizer
```

With Docker, the image is now built from `docker/Dockerfile` and `generate-docker-compose.sh` is gone. Before updating, dump the database from the running MongoDB container, then move the old database files aside:

```
docker compose exec mongodb mongodump --db sugarizer --out /data/db/dump
docker compose down
mv docker/db/dump ../sugarizer-dump
mv docker/db ../sugarizer-db-old
```

Update Sugarizer Server (`git pull`), start the new containers, and restore the dump:

```
docker compose up -d --build
docker compose cp ../sugarizer-dump mongodb:/tmp/dump
docker compose exec mongodb mongorestore --db sugarizer /tmp/dump/sugarizer
```

The server now listens on port 8080 inside its container (it was 80) and runs as a non-root user; the published ports are unchanged.


## Migrate to 1.5.0
Two new collections need to be added to the `[collections]` section of your `.ini` file:

```
assignments = assignments
activities = activities
```

Sugarizer Server version 1.5.0 require MongoDB 3.2+.
Recent versions of MongoDB don't support old database file format so we recommend to dump your current database before upgrading to avoid losing data.

Depending from the way you're running Sugarizer Server, follow the migration guide below.

See [MongoDB documentation](https://www.mongodb.com/docs/database-tools/) for more information.

### Running Sugarizer Server on your computer

If Sugarizer Server and MongoDB run from your computer.

First stop Sugarizer Server, then launch dump command.

```
mongodump --db=sugarizer 
```

A `dump/sugarizer` directory has been created on the `db` directory.

Now stop MongoDB and upgrade it to a recent version. Then launch the new MongoDB engine.

Finally, launch the restore command.

```
mongorestore --db=sugarizer dump/sugarizer
```


### Running Sugarizer Server using Docker

First identify the id for the MongoDB container by running.

```
docker ps
```

The id is the one on the line named `sugarizer-server_mongodb`.

Now attach a bash shell on the running MongoDB instance by running:

```
docker exec -it <IdOfDockerForMongoDB> /bin/bash
```

Then launch the dump command.
:

```
cd /data/db 
mongodump --db=sugarizer 
```

You could exit from the bash shell.
A new directory `dump` has been created in `sugarizer-server/docker/db`.

You must now delete the container and the old MongoDB image. Type following commands:

```
docker rm <IdOfDockerForMongoDB>
docker rmi sugarizer-server_mongodb:latest
```

You could now upgrade Sugarizer Server, probably just by doing a `git pull`.

Once Sugarizer Server is upgraded, regenerate the docker file by a call to:

```
sh generate-docker-compose.sh
```

Then run new containers:

```
docker-compose up -d
```

It could take some time and a message telling than mongodb is building should appears.

Follow the same process than before to attach a bash shell on the new running Mongodb instance:

```
docker ps
docker exec -it <IdOfDockerForNewMongoDB> /bin/bash
```

Finally launch the restore command:

```
cd /data/db 
mongorestore --db=sugarizer dump/sugarizer 
```

