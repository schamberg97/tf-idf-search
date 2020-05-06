var path = require('path')

require('dotenv').config()


var cluster = require('cluster')
global.sendToMaster = function(obj) {
	if (cluster.isWorker) {
		obj.contents.workerID = cluster.worker.id
		process.send(obj)
	}
}

var originalLog = console.log;
var timeString = function(noSpaceParam) {
	var d = new Date();
	var day = d.getDate().toString();
	if (day.length == 1) {
		day = "0" + day;
	}
	var month = d.getMonth() + 1;
	month = month.toString();
	if (month.length == 1) {
		month = "0" + month;
	}
	var year = d.getFullYear();
	
	var hours = d.getHours().toString();
	if (hours.length == 1) {
		hours = "0" + hours;
	}
	
	var minutes = d.getMinutes().toString();
	if (minutes.length == 1) {
		minutes = "0" + minutes;
	}
	
	var seconds = d.getSeconds().toString();
	if (seconds.length == 1) {
		seconds = "0" + seconds;
	}
	if (noSpaceParam) {
		return year+"."+month+"."+day+"_"+hours+":"+minutes+":"+seconds;
	}
	else {
		return day+"."+month+"."+year+" "+hours+":"+minutes+":"+seconds+" ";
	}
}

let mainPath = path.resolve(path.dirname(require.main.filename))

var primary = require(path.resolve(`${__dirname}/primary.js`))


