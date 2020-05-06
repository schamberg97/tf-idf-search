var path = require('path')
//var { RateLimiterCluster, RateLimiterMongo } = require('rate-limiter-flexible');
var databaseComponent = require(path.resolve(path.dirname(require.main.filename) + '/database.js'))
var fs = require('fs')

var cluster = require('cluster')


var rateLimiterPoints = 80
if (cluster.isWorker) {
    var { RateLimiterCluster, RateLimiterMongo } = require('rate-limiter-flexible');
    var rateLimiterMemoryDynamic = new RateLimiterCluster({
        keyPrefix: 'rl0',
    	points: rateLimiterPoints, 
    	duration: 1,
        blockDuration: 60,
        execEvenly: true
    });
}
else {
    var { RateLimiterMemory, RateLimiterMongo } = require('rate-limiter-flexible');
    var rateLimiterMemoryDynamic = new RateLimiterMemory({
        keyPrefix: 'rl0',
    	points: rateLimiterPoints, 
    	duration: 1,
        blockDuration: 60,
        execEvenly: true
    });
}
const rateLimiterDynamic = new RateLimiterMongo({
    //points: 20,
    //duration: 1,
    //blockDuration: 60,
    execEvenly: true,
    points: rateLimiterPoints,
    duration: 1,
	blockDuration: 15,
    storeClient: databaseComponent.getDb('clientOnly'),
    dbName: process.env.MONGODB_DB_NAME,
	tableName: 'users-rate-limit-dynamic',
	keyPrefix: 'rl0',
	inmemoryBlockOnConsumed: 250,
	inmemoryBlockDuration: 60,
	insuranceLimiter: rateLimiterMemoryDynamic
});

var moment=require('moment')



const i18n = require("i18n");


module.exports = function (app, sessionMiddleware) {

    if (cluster.isWorker) {
        //process.send({ 
        //    contents:{
        //        code: 'web-operational',
        //        workerID: cluster.worker.id
        //    }
        //});
        sendToMaster({
            contents: {
                code: 'web-operational'
            }
        })
    }
    app.use(i18n.init);

    

    i18n.configure({
        locales: ['en', 'ru'],
        directory: path.resolve(__dirname + '/locales'),
        register: global,
        defaultLocale: 'en',
    });
        
    app.use(sessionMiddleware)
    require(path.resolve(__dirname + '/static.js'))(app) 

	app.all('*', (req, res, next) => {
        let key = req.ip;
        let pointsToConsume = 1
        rateLimiterDynamic.consume(key, pointsToConsume)
            .then((rateLimiterRes) => {
                next()
            })
            .catch((rej) => {
                let obj = {
                    req,res,next
                }
                //console.log(obj)
                console.log(rej)
                if (rej.consumedPoints < rateLimiterPoints + 5) {
                    req.setTimeout(rej.msBeforeNext + 10000);
                    setTimeout(continueDoing, rej.msBeforeNext)
                    function continueDoing() {
                        rateLimiterDynamic.consume(key, pointsToConsume)
                        next()
                    }

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
    })
    
    require(path.resolve(__dirname + '/subroutines/uploadArticle.js'))(app)
    //require(path.resolve(__dirname + '/subroutines/searchArticle.js'))(app)

    app.get('/', (req,res) => {
        res.render('index')
    })

    app.get('/test-i18n/', (req,res) => {
        res.send(__('i18n-works'))
    })

	app.all('*', (req,res) => {
        res.json({status:'ok'})	
	})

}