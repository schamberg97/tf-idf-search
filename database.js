var fs = require('fs')
const spawn = require('child_process').spawn;
const { MongoClient } = require('mongodb');
const os = require('os')
var path = require('path')

process.env.MONGODB_DB_URL = process.env.MONGODB_DB_URL || 'mongodb://localhost:27017';
process.env.MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'academic-pdf-search';

let _db;

module.exports = {
	initDb,
	getDb,
	bucket,
	closeDB
};

function initDb(callback) {
	if (_db) {
		console.warn("Trying to init DB again!");
		return callback(null, _db);
	}
	var client = new MongoClient(process.env.MONGODB_DB_URL, {  useNewUrlParser: true, useUnifiedTopology: true, retryWrites:true });
	client.connect(connected)
	function connected(err, db) {
		if (err) {
			if (process.env.DEBUG == "true") {
				console.log(err)
			}
			return callback(err);
		}
		console.log("DB initialized - connected");
		_db = db // needed to populate database.js global _db object

		callback(null,_db)
		
	}
}

function getDb(mode,colName) {
	if (!_db) {
		console.warn("DB not initialized")
		return 'db-uninitialized'
	}
	else {
		if (mode == "clientOnly") {
			return _db
		}
		else if (!mode || mode == "wholeDB") {
			return _db.db(process.env.MONGODB_DB_NAME);
		}
		else if (mode == "collection") {
			return _db.db(process.env.MONGODB_DB_NAME).collection(colName);
		}
	}
}

function bucket(name) {
	let mongodb = require('mongodb')
	let bucket = new mongodb.GridFSBucket(getDb('wholeDB'), {chunkSizeBytes: 1024, bucketName: name}) 
	return bucket
}

function closeDB(callback) {
	_db.close(callback)
}