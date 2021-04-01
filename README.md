## MovieDB (backend)

## Setup
Install MongoDB, then run
``` bash
mongod --dbpath db
```
``` bash
mongo
```
In MongoDB shell run
``` bash
use moviedb_clean
```

Install dependencies
``` bash
npm install
```

## Run
The project is mostly meant to be run from the frontend side (https://github.com/DrBrake/moviedb-front), but you can also run the backend on it's own.

Develop
``` bash
npm run dev-server
```