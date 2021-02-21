const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

exports.movieSchema = new Schema({
  _id: ObjectId,
  MovieID: Number,
  MovieName: String,
  MovieCode: String,
  MovieYear: Number,
  MovieAdded: String,
  MovieLocation: Array,
  MovieImage: String,
  MovieThumbnail: String,
  MoviePlays: Number,
  MovieGenres: Array,
  MovieActors: Array,
  MovieStudio: String,
});

exports.actorSchema = new Schema({
  _id: ObjectId,
  ActorID: Number,
  ActorName: String,
  ActorBirthday: String,
  ActorAdded: String,
  ActorImage: String,
});

exports.genreSchema = new Schema({
  _id: ObjectId,
  GenreID: Number,
  GenreName: String
});