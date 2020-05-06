
var path = require('path')
var productInfo = require(path.resolve(`${__dirname}/productInfo.js`))
var database = require(path.resolve(`${__dirname}/database.js`))
var webComponent = require(path.resolve(`${__dirname}/web.js`))
var cluster = require('cluster')
const numProc = process.env.NUM_PROC || require('os').cpus().length;
var totalShutdown

const noCluster = process.env.NO_CLUSTER == "true"
console.log("noCluster: " + noCluster)


function runMaster() {
    console.log(`Master ${process.pid} is running`);
    const { RateLimiterClusterMaster } = require('rate-limiter-flexible');
    new RateLimiterClusterMaster();
    for (let i = 0; i < numProc; i++) {
        if (process.env.DEBUG_MODE == "true") {
            console.log('Spawning worker process')
        }
        cluster.fork({
            DELAY: 'true',
        })

    }

    function deathHandler(code,signal) {
        console.log(`Code: ${code}, signal: ${signal}`)
        if (code !== 0 && totalShutdown != "true") {
            
            console.log('worker failed. starting new one')
            let worker = cluster.fork()
            worker.on('message', messageHandler);
            worker.on('exit', deathHandler)
        }
    }

    function restartWorker() {
        if (totalShutdown != "true") {
            console.log("Worker is dead. Long live the worker")
            let worker = cluster.fork()
            worker.on('message', messageHandler);
            worker.on('exit', deathHandler)
        }
    }
    
    for (const id in cluster.workers) {
        cluster.workers[id].on('message', messageHandler);
        cluster.workers[id].on('exit', deathHandler)
    }
    function messageHandler(msg) {
        if (msg && msg.contents) {
            switch (msg.contents.code) {
                case "start-up":
                    console.log(`Worker #${msg.contents.workerID} is starting`)
                    break;
                case "connected-to-db":
                    console.log(`Worker #${msg.contents.workerID} connected to DB`)
                    break;
                case "web-operational":
                    console.log(`Worker #${msg.contents.workerID} is serving content`)
                    break;
                case "worker-shutdown":
                    restartWorker()
                    console.log(`Worker #${msg.contents.workerID} is shutting down`)
                    break;
                case "global-shutdown":
                    console.log(`Worker #${msg.contents.workerID} requested global shutdown`)
                    totalShutdown = true
                    for (const id in cluster.workers) {
                        setTimeout(() => {
                            cluster.workers[id].disconnect
                        }, 9500);
                    }
                    break;
                case "restart-request":
                    console.log(`Worker #${msg.contents.workerID} requested global workers restart`)
                    for (const id in cluster.workers) {
                        cluster.workers[id].disconnect()
                        let timeout = setTimeout(() => {
                            cluster.workers[id].kill();
                        }, 7500);
                    }
                    break;
                case "settings-change":
                    console.log(`Worker #${msg.contents.workerID} reported change of settings`)
                    //cluster.workers[msg.contents.workerID].destroy()
                    var newMsg = {
                        contents: {
                            code: "new-settings",
                            workerID: null,
                            settingsChanged: msg.contents.settingsChanged,
                            settingsContents: msg.contents.settingsContents
                        }
                    }
                    for (const id in cluster.workers) {
                        cluster.workers[id].send(newMsg)
                    }
                    break;

            }
        }
    }
}
if (cluster.isMaster && noCluster != true) {
    var pyPath
    var os = require('os')
    let {PythonShell} = require('python-shell');
    if (os.platform == "darwin") {
        pyPath = "/usr/local/bin/python3";
    }
    else if (os.platform == "linux") {
        pyPath = "/usr/bin/python3";
    }
    if (process.env.PYTHON_LOC) {
        pyPath = process.env.PYTHON_LOC;
    }
    let mainPath = path.resolve(path.dirname(require.main.filename))
    console.log(mainPath)
    let options = {
        mode: 'text',
        pythonPath: pyPath,
        //pythonOptions: ['-u'], // get print results in real-time
        scriptPath: mainPath+'/python/',
        //args: ['value1', 'value2', 'value3']
    };
    PythonShell.run('firstrun.py', options, function (err,results) {
        if (err) throw err;
        console.log(results)
        runMaster()
    });
}
else if (!cluster.isMaster && noCluster != true){
    var randomTime = process.env.DEBUG_WORKER_RESTART_TIME || Math.floor((Math.random() * 7200000) + 3600000);
    sendToMaster({
        contents: {
            code: 'start-up', 
        }
    });

    init()
    
    function init() {
        database.initDb(function (err, db) {
            //console.log(err || db)
            if (db) {
                var web = new webComponent(productInfo, db)
                sendToMaster({
                    contents: {
                        code: 'connected-to-db',
                    }
                });
                web.start()
                console.log(process.pid + " :: I will restart in around " + Math.round(randomTime / 60000) + " minutes")
                setTimeout(gracefulClose, randomTime, web);
                process.on('disconnect', () => {
                    gracefulClose(web);
                });
            }
            else {
                process.exit(1)
            }
        })
        function gracefulClose(web) {
            sendToMaster({
                contents: {
                    code: 'worker-shutdown',
                }
            });
            web.stop(function (err) {
                if (err) {
                    process.exit(21)
                }
                else {
                    database.closeDB(function (e, o) {
                        if (err) {
                            console.log('Database is NOT cleanly shutdown.');
                            process.exit(22)
                        }
                        else {
                            console.log('Database is cleanly shutdown.');
                            //setTimeout(process.exit, 30000)
                            process.exit(0)
                        }
                    })
                }
            })
        }
    }
}
else {
    database.initDb(function (err, db) {
        //console.log(err || db)
        if (db) {
            var web = new webComponent(productInfo, db)
            web.start()
        }
        else {
            process.exit(1)
        }
    })

}
