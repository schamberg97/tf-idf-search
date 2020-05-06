var path = require('path')
var databaseComponent = require(path.resolve(path.dirname(require.main.filename) + '/database.js'))
var articlesBucket = databaseComponent.bucket("articles");
var articles = databaseComponent.getDb('collection','articles')
var multer  = require('multer')
var mime = require('mime-type/with-db')
const fileType = require('file-type');
var streamBuffers = require('stream-buffers');
var simpleMathOps = require(path.resolve(path.dirname(require.main.filename) + '/simpleMathOps.js'))
var mkdirp = require('mkdirp');
var getDirName = require('path').dirname;
var fs = require('fs-extra');


let PDFParser = require("pdf2json");

let {PythonShell} = require('python-shell');
var os = require('os')

var upload = multer({limits: {fileSize: 1048576 * 2, files: 1}})

module.exports = function (app) {

    function createArticle(req,res,next,noServe) {
        var articleDetails = {
            title: req.body.title,
            description: req.body.description,
            authors: req.body.authors.split(',').map((item) => {return item.trim()}),
            guid: simpleMathOps.guid(),
            searchEnabled: false,
        }
        res.locals.guid = articleDetails.guid
        if(req.body.parseImmediately) {
            res.locals.parseImmediately = req.body.parseImmediately
        }
        articles.insertOne(articleDetails, function(e,o) {
            if (e) {
                finishServe(req,res,500,'error','db-error',null)
            }
            else {
                delete articleDetails._id
                if (noServe) {
                    next()
                }
                else {
                    finishServe(req,res,200,'success',null,articleDetails)
                }
            }
        })
    }

    app.post('/createArticle/', (req,res,next) => {
        createArticle(req,res,next)
    })

    app.post('/uploadArticle/', upload.single('article'), (req,res,next) => {
        console.log(req.body)
        console.log()
        console.log(res.locals)
        if (req.body.title && req.body.description && req.body.authors) {
            res.setTimeout(500000, function(){
                finishServe(req,res,503,'error','timeout',null)
            })
            createArticle(req,res,next,true)
        }
        else {
            next()
        }
    })

    app.post('/uploadArticle/', upload.single('article'), (req,res,next) => {
        console.log(req.body)
        console.log()
        console.log(res.locals)
        if (res.locals.guid || req.body.guid) {
            articles.find({guid: res.locals.guid || req.body.guid}, {_id: 1}).project({_id:1}).limit(1).toArray(function(err, document) {
                if (err) {
                    finishServe(req,res,500,'error','db-error',null)
                }
                else if (!document || document.length !== 1) {
                    finishServe(req,res,404,'error','article-not-found',null)
                }
                else {
                    fileProcess()
                }
            });
            
        }
        else {
            //fileProcess()
            finishServe(req,res,500,'error','article-guid-not-specified',null)
        }
        function fileProcess() {
   		    try {
   		    	if (req.file) {
		    		console.log('file was uploaded')
		    		
                    
		    		if (req.file.mimetype == 'application/octet-stream' || !req.file.mimetype) {
		    			var ext = path.extname(req.file.originalname);
		    			if (ext) {
		    				let extMime = mime.lookup(ext)
		    				if (!extMime) {
		    					backupCheck()
		    				}
		    				else {
		    					req.file.mimetype = extMime;
		    				}
		    			}
		    			else {
		    				backupCheck()
		    			}
		    			function backupCheck() {
		    				let ft = fileType(req.file.buffer)
		    				if (ft.mime != "application/x-msi" && ft.mime != "application/x-executable" && ft.mime != "application/x-java-archive" && ft.mime != "application/x-msdos-program" && ft.mime != "application/vnd.microsoft.portable-executable") {
		    					req.file.mimetype = ft.mime;
		    					req.file.originalname = req.file.originalname + "." + ft.ext
		    				}
		    				else {
		    					throw "bad-file"
		    				}
		    			}
		    		}
		    			//console.log(req.files[n]) 
                    
                }

		    	next()
		    }
		    catch (e) {
                finishServe(req,res,400,'error','possibly-bad-files',null)
            }
        }
    })

    app.post('/uploadArticle/', (req,res,next) => {
        if (req.file) {
            var fileObj = {}
            
            //let myArticleStream = new streamBuffers.ReadableStreamBuffer({
            //    frequency: 10,      // in milliseconds.
            //    chunkSize: 2048     // in bytes.
            //}); 
            //myArticleStream.pipe(articlesBucket.openUploadStream(simpleMathOps.guid() + '.pdf'))
            //    .on('error', function(error) {
            //        console.log(error)
            //    })
            //    .on('finish', function() {
            //        console.log('done!');
            //        process.exit(0);
            //    });
            var stream = require('stream');
            var bufferStream = new stream.PassThrough();
            bufferStream.end(req.file.buffer);
                    
            let fileGuid = simpleMathOps.guid()
            bufferStream.pipe(articlesBucket.openUploadStream(fileGuid + '.pdf'))
                .on('error', function(error) {
                    fileObj = {
                        upload: 'fail',
                        id: fileGuid
                    }
                    finishServe(req,res,500,'error','file-failed-to-upload-to-db',fileObj)
                    //function finishServe(req,res,statusCode,status,error,obj) {
                })
                .on('finish', function() {
                    fileObj = {
                        upload: 'ok',
                        id: fileGuid
                    }
                    articles.findOneAndUpdate({guid:res.locals.guid  || req.body.guid}, {$set:{fileGUID: fileGuid}}, {returnOriginal : false}, function(e,o) {
                        if (e || !o) {
                            finishServe(req,res,500,'error','failed-to-update-article-record',fileObj)
                        }
                        else {
                            if (res.locals.parseImmediately) {
                                parseArticle(req,res,fileGuid+'.pdf', res.locals.guid  || req.body.guid)
                            }
                            else {
                                finishServe(req,res,null,null,null,fileObj)
                            }
                            
                        }
                    });
                    
                    
                });
        }
        else {
            finishServe(req,res,null,null,'no-file',fileObj)
        }
    })

    app.get('/uploadArticle/parse/:fileName/:articleGUID/', (req,res) => {
        //parsePDF(req.file, req.body.guid)

                    //file itself; its article document
        //const file = articlesBucket
    	//	.find({
    	//		filename: req.params.guid
    	//	})
    	//	.toArray((err, files) => {
    	//		if (!files || files.length === 0) {
    	//			return res.status(404).json({code: '404', status: 'error', error: "not-found"});
    	//		}
    	//		articlesBucket.openDownloadStreamByName(req.params.guid).pipe(res);
        //    });
        //console.log(os.tmpdir())
        parseArticle(req,res,req.params.fileName, req.params.articleGUID)
    })


}

function parseArticle(req,res,fileName,articleGUID) {

    let fsFileName = os.tmpdir() + "/" + fileName
        var writeStream = fs.createWriteStream(fsFileName);
        var dStream = articlesBucket.openDownloadStreamByName(path.basename(fileName)).pipe(writeStream)
        .on('error', function (error) {
            console.log(error);
            res.status(404).json({ code: '404', status: 'error', error: "not-found" });
        }).on('finish', function () {
            writeStream.close()
            readFile()
        });
        function readFile() {
            fs.readFile(fsFileName, (err, data) => {
                if (err) {
                    res.status(500).json({
                        code: 500,
                        status: "server-error",
                        stage: 1,
                        reason:JSON.stringify(err)
                    })
                }
                else {
                    let file = {
                        buffer: data
                    }
                    parsePDF(file, articleGUID,req,res)
                }
            })
        }
}

function finishServe(req,res,statusCode,status,error,obj) {
    if (!status || status == null) {
        status = 'ok'
    }
    if (!statusCode || statusCode == null) {
        statusCode = 200
    }
    if (!error) {
        error = null
    }
    let resObj = {
        code: statusCode, status, error, data:obj
    }
    if (!resObj.error) {
        delete resObj.error
    }
    if (!resObj.obj) {
        delete resObj.obj
    }
    res.status(resObj.code).json(resObj)

}

function parsePDF(file, articleGUID, req,res) {
    
    //var hrstart = process.hrtime()
    
    let pdfParser = new PDFParser(this,1);

    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
    pdfParser.on("pdfParser_dataReady", pdfData => {
        let text =pdfParser.getRawTextContent();
        
        text = text.replace(/:/gim, ' ');
        text = text.replace(/(----------------Page\s\(\d+\)\sBreak----------------)/gim, '')
        //text = text.match(/[A-ZА-ЯЁ][a-zа-яё]+|[0-9]+/gim).join(" ")
        //text = text.match(/[A-ZА-ЯЁ][a-zа-яё]+|[0-9]+/gim).join(" ")
        text = text.replace(/([A-ZА-ЯЁ']+)/gim, " $1").trim()
        text = text.replace(/[^a-zа-яё‒'\s]+/gim, "");
        
        text = text.replace(/(\b(\w{1,3})\b(\W|$))/g,'')
        text = text.replace(/\s\s+/gim, ' ');
        //var hrend = process.hrtime(hrstart)
        //console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
        let tmpLoc = os.tmpdir() + '/' + articleGUID
        
        fs.outputFile(tmpLoc + '/file.txt', text, function(err) {
            if (err) {
                console.log(err)
                
                res.status(500).json({
                    code: 500,
                    status: "server-error",
                    stage: 2,
                    reason:JSON.stringify(err)
                })
            }
            else {
                processFileTF(articleGUID, tmpLoc,req,res)
            }
        })
        
        
    });
    pdfParser.parseBuffer(file.buffer);

}

function processFileTF(articleGUID, tmpLoc,req,res) {
    var pyPath
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
    console.log(tmpLoc)
    let options = {
        mode: 'text',
        pythonPath: pyPath,
        //pythonOptions: ['-u'], // get print results in real-time
        scriptPath: mainPath+'/python/',
        args: ['-r', 'local', '-o', tmpLoc, tmpLoc+'/file.txt']
      };

    //console.log(text)

    PythonShell.run('tf-idf.py', options, function (err,results) {
        if (err) {
            console.log(err);
            res.status(500).json({
                code: 500,
                status: "server-error",
                stage: 3,
                reason:JSON.stringify(err)
            })
        }
        else {
            furtherProcessing(articleGUID,tmpLoc,req,res)
        }
    });

}

function furtherProcessing(articleGUID,tmpLoc,req,res) {
    fs.unlink(tmpLoc+'/file.txt', function (err) {
        if (err) {
            res.status(500).json({
                code: 500,
                status: "server-error",
                stage: 4,
                reason: err
            })
            
        }
        else {
            var concatArr = require('child_process').execSync('cat ' +tmpLoc+'/*').toString('UTF-8').split("\n")
            
            
            
            var wordTfObj ={}
            concatArr.forEach((item,index) => {
                if (item.length) {
                    item = item.slice(2)
                    item = item.split('"')
                    word = item[0]
                    //console.log(index)
                    //console.log(item)
                    tf = item[3].split('\t')[1]
                    wordTfObj[word] = tf
                }
            })
            let obj = {
                words: wordTfObj,
                searchEnabled:true
            }
            console.log(obj)
            console.log('articleGUID:' + articleGUID)
            articles.findOneAndUpdate({guid:articleGUID}, {$set:obj}, {returnOriginal : false}, function(e,o) {
                if (e || o == null) {
                    res.status(500).json({
                        code: 500,
                        status: "server-error",
                        stage: 5,
                        reason:JSON.stringify(e || 'generic-error')
                    })
                }
                else {
                    console.log('got here')
                    res.status(200).json({
                        code: 200,
                        status: "success"
                    })
                }
            });
        }
    }); 
}