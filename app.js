const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const schemas = require('./schema');
const sharp = require('sharp');
const last = require('lodash/last');
const fs = require('fs');

require('@tensorflow/tfjs-node');
const canvas = require('canvas');
const faceapi = require('face-api.js');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();

const movieModel = mongoose.model('Movie', schemas.movieSchema, 'movies');
const actorModel = mongoose.model('Actor', schemas.actorSchema, 'actors');
const genreModel = mongoose.model('Genre', schemas.genreSchema, 'genres');
const ObjectId = mongoose.Types.ObjectId;

const dir = path.join(__dirname, 'public');

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:6969");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/moviedb', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
  console.log("Database connection established successfully");
});

faceapi.nets.ssdMobilenetv1.loadFromDisk(`${dir}/models`);

app.get('/', async (req, res) => {
  const movieQuery = movieModel.find().exec();
  const actorQuery = actorModel.find().exec();
  const genreQuery = genreModel.find().exec();
  try {
    let [movies, actors, genres] = await Promise.all([movieQuery, actorQuery, genreQuery]);
    res.send({ movies, actors, genres });
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/movie', async (req, res) => {
  const body = req.body;

  const actorErr = [];
  const genreErr = [];

  try {
    body.MovieActors = body.MovieActors.split(', ');
    body.MovieGenres = body.MovieGenres.split(', ');

    for (let i = 0; i < body.MovieActors.length; i++) {
      const actor = await actorModel.findOne({ 'ActorName': body.MovieActors[i] });
      if (actor) body.MovieActors[i] = actor.ActorID;
      else {
        const latest = await actorModel.find().sort({ 'ActorID': -1 });
        if (latest && latest[0] && latest[0].ActorID) {
          const newActorID = latest[0].ActorID + 1;
          const newActor = new actorModel({ '_id': new ObjectId(), 'ActorID': newActorID, 'ActorName': body.MovieActors[i], 'ActorAdded': dayjs().format() });
          newActor.save((err, doc) => {
            if (err) actorErr.push(err);
            else {
              body.MovieActors[i] = doc.ActorID;
            }
          });
        }
      }
    }
    if (actorErr.length > 0) {
      return res.send(500, {error: actorErr.toString()});
    }

    for (let i = 0; i < body.MovieGenres.length; i++) {
      const genre = await genreModel.findOne({ 'GenreName': body.MovieGenres[i] });
      if (genre) body.MovieGenres[i] = genre.GenreID;
      else {
        const latest = await genreModel.find().sort({ 'GenreID': -1 });
        if (latest && latest[0] && latest[0].GenreID) {
          const newGenreID = latest[0].GenreID + 1;
          const newGenre = new genreModel({ '_id': new ObjectId(), 'GenreID': newGenreID, 'GenreName': body.MovieGenres[i] });
          newGenre.save((err, doc) => {
            if (err) genreErr.push(err);
            else {
              body.MovieGenres[i] = doc.GenreID;
            }
          });
        }
      }
    }
    if (genreErr.length > 0) {
      return res.send(500, {error: genreErr.toString()});
    }

    movieModel.findOneAndUpdate({'MovieID': body.MovieID}, body, {upsert: true}, (err, doc) => {
        if (err) return res.send(500, {error: err});
        return res.status(200).send();
    });
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/actor', async (req, res) => {
  const body = req.body;
  try {
    actorModel.findOneAndUpdate({'ActorID': body.ActorID}, body, {upsert: true}, (err, doc) => {
        if (err) return res.send(500, {error: err});
        return res.status(200).send();
    });
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/play', async (req, res) => {
  const body = req.body;
  try {
    movieModel.findOneAndUpdate({'MovieID': body.MovieID}, {$inc: {MoviePlays: 1}}, (err, doc) => {
        if (err) return res.send(500, {error: err});
        return res.status(200).send();
    });
  } catch(error) {
    res.status(500).send(error);
  }
});

app.get('/images/:type/:image', async (req, res) => {
  const width = req.query.w && parseInt(req.query.w);
  const widthIsNumber = !isNaN(width);

  const height = req.query.h && parseInt(req.query.h);
  const heightIsNumber = !isNaN(height);

  const onlyBack = req.query.back;
  const onlyFront = req.query.front;
  const onlySpine = req.query.spine;
  const onlyFace = req.params.type === "faces";

  const faceDetection = async (inputFile) => {
      const imageName = last(inputFile.split("/"));
      const actorFile = inputFile.replace("faces", "actor");
      const img = await canvas.loadImage(actorFile);
      const detection = await faceapi.detectSingleFace(img);
      if (detection) {
        const widthOffset = detection.imageWidth / 10;
        const heightOffset = detection.imageHeight / 10;
        const valueOrZero = (value) => {
          if (value < 0) return 0;
          return value;
        }
        return sharp(actorFile)
        .jpeg({ quality: 100 })
        .extract({
          width: parseInt(detection.box.width + widthOffset),
          height: parseInt(detection.box.height + heightOffset),
          left: valueOrZero(parseInt(detection.box.x - (widthOffset / 2))),
          top: valueOrZero(parseInt(detection.box.y - (heightOffset / 2))),
        })
        .resize(40, 40)
        .toFile(`${dir}/images/faces/${imageName}`);
      }
      return Promise.reject();
  }

  const makeImage = async (inputFile) => {
    if (onlyBack || onlyFront) {
      return sharp(inputFile)
        .webp({ quality: 100 })
        .resize(400, 568, { position: onlyBack ? "left top" : "right top" })
        .toBuffer();
    } else if (onlySpine) {
      return sharp(inputFile)
        .webp({ quality: 100 })
        .resize(41, 568)
        .toBuffer();
    } else if (onlyFace) {
      try {
        if (!fs.existsSync(inputFile)) await faceDetection(inputFile);
        return sharp(inputFile)
          .webp({ quality: 80 })
          .toBuffer();
      } catch (err) {
        console.log(err);
        return null;
      }
    }
    return sharp(inputFile)
      .webp({ quality: 100 })
      .resize(widthIsNumber ? width : null, heightIsNumber ? height : null)
      .toBuffer();
  };

  const sendData = (data, status) => {
    res.writeHead(status, {
      'Content-Type': 'image/webp',
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(data);
  }

  try {
    const data = await makeImage(`${dir}/images/${req.params.type}/${req.params.image}`);
    if (data) sendData(data, 200);
    else res.status(500).send();
  } catch(error) {
    try {
      if (req.params.type === "movie") {
        const data = await makeImage(`${dir}/images/cover_placeholder.jpg`);
        if (data) sendData(data, 404);
      } else if (req.params.type === "thumbnails") {
        const data = await makeImage(`${dir}/images/thumbnail_placeholder.jpg`);
        if (data) sendData(data, 404);
      } else if (req.params.type === "actor") {
        const data = await makeImage(`${dir}/images/actor_placeholder.jpg`);
        if (data) sendData(data, 404);
      }
    } catch(error) {
      console.log(error);
      res.status(500).send(error);
    }
  }
});

app.listen(8080, () => { console.log('Listening at port 8080') });