var path = require('path')
var { RateLimiterCluster, RateLimiterMongo } = require('rate-limiter-flexible');
var databaseComponent = require(path.resolve(path.dirname(require.main.filename) + '/database.js'))
var articlesBucket = databaseComponent.bucket("articles");
var fs = require('fs')

var cluster = require('cluster')

if (cluster.isWorker) {
    var { RateLimiterCluster, RateLimiterMongo } = require('rate-limiter-flexible');
    var rateLimiterMemoryStatic = new RateLimiterCluster({
		keyPrefix: 'rl1',
		points: 400,    
		duration: 1,
		blockDuration: 60,
		execEvenly: true
	});
}
else {
	var { RateLimiterMemory, RateLimiterMongo } = require('rate-limiter-flexible');
	var rateLimiterMemoryStatic = new RateLimiterMemory({
        keyPrefix: 'rl1',
    	points: 400, 
    	duration: 1,
        blockDuration: 60,
        execEvenly: true
    });
}


const rateLimiterStatic = new RateLimiterMongo({
    points: 400,
	duration: 1,
	blockDuration: 60,
    storeClient: databaseComponent.getDb('clientOnly'),
    dbName: process.env.MONGODB_DB_NAME,
	tableName: 'users-rate-limit-static',
	keyPrefix: 'rl1',
	inmemoryBlockOnConsumed: 600,
	inmemoryBlockDuration: 60,
	insuranceLimiter: rateLimiterMemoryStatic,
	execEvenly: true
});
function rateLimit(req,res, key, pointsToConsume, serveStatic){
	rateLimiterStatic.consume(key, pointsToConsume)
        .then((rateLimiterRes) => {
			
            serveStatic(req,res)
        })
        .catch((rej) => {
			if (req.ip == "127.0.0.1") {
				serveStatic(req,res)
			}
			else {
            	let response = {
            	    code: 429,
            	    status: "too-many-requests",
            	    retryIn: rej.msBeforeNext //milliseconds
            	}
				res.status(429).json(response)
			}
		});
}

function serveStaticStandard(req,res) {
	fs.access(path.resolve(path.dirname(require.main.filename) + req.path), fs.F_OK, (err) => {
		if (err) {
			res.status(404).json({
				status: 404,
				reason: "not-found"
			})
		}
		else {
			res.status(200).sendFile(path.resolve(path.dirname(require.main.filename) + req.path));
		}
	})
}

module.exports = function (app) {
	//require(path.resolve(__dirname + '/subroutines/staticContent.js'))(app)
	app.get('/static/*', function(req,res) {
		let key = req.ip;
		let pointsToConsume = 10
		if (req.session.user) {
			key = req.session.user.user
			pointsToConsume = 1
		}
		
		rateLimit(req,res, key, pointsToConsume, serveStaticStandard)
	});
	app.get('/content/*', function(req,res) {
		let key = req.ip;
		let pointsToConsume = 30
		if (req.session.user) {
			key = req.session.user.user
			pointsToConsume = 1
		}
		
		rateLimit(req,res, key, pointsToConsume, serveStaticStandard)
	});

	app.get('/downloadArticle/:guid/article.pdf', function(req,res) {
		let key = req.ip;
		let pointsToConsume = 30
		if (req.session.user) {
			key = req.session.user.user
			pointsToConsume = 1
		}
		
		function serveArticle() {
			
			const file = articlesBucket
    		.find({
    			filename: req.params.guid
    		})
    		.toArray((err, files) => {
    			if (!files || files.length === 0) {
    				return res.status(404).json({code: '404', status: 'error', error: "not-found"});
    			}
    			articlesBucket.openDownloadStreamByName(req.params.guid).pipe(res);
    		});
			
		}

		rateLimit(req,res, key, pointsToConsume, serveArticle)
		
	});

}