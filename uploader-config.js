var config = require('nconf');
var log = require('log4js').getLogger('speck-uploader:config');
var RunMode = require('run-mode');

var configFile = './uploader-config-' + RunMode.get() + '.json';
log.info("Using config file (if it exists): " + configFile);

config.argv().env();
config.add('global', { type : 'file', file : configFile });

config.defaults({
                   "csv" : "./speck_cc3af991c1069101f2019221b2857f41.csv",
                   "esdr" : {
                      "apiRootUrl" : "http://localhost:3000/api/v1",
                      "feedId" : "61ddf3b529642dc8a4d0e97573d6d77b25860746cb846d6a92b9ac9dbbfa7dc2"
                   },
                   "maxRecordsPerUpload" : 1000
                });

module.exports = config;