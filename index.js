var Speck = require('speck-sensor');
var fs = require('fs');
var path = require('path');
var info = require('debug')('info');
var debug = require('debug')('debug');
var error = require('debug')('error');

var LINE_SEPARATOR = "\n";

var speck = Speck.create();
var csvFieldNames = [];
var sampleIntervalMillis = null;
var dataSamplesFile = null;

var arrayToCsvRecord = function(a) {
   return a.join(",") + LINE_SEPARATOR;
};

var writeSample = function(dataSample) {
   var values = [];
   csvFieldNames.forEach(function(fieldName) {
      values.push(dataSample[fieldName]);
   });
   var record = arrayToCsvRecord(values);
   fs.appendFileSync(dataSamplesFile, record);
};

var readSample = function() {
   speck.getSample(function(err, dataSample) {

      // set the default timeout interval to whatever the Speck's logging interval is
      var timeoutInterval = sampleIntervalMillis;

      if (err) {
         error("Error getting sample.  Will wait 1 minute before trying again.  Error: " + err);
      }
      else if (dataSample != null) {
         writeSample(dataSample);

         // since we found a historical sample, try to fetch the next one immediately
         timeoutInterval = 1;
      }

      setTimeout(readSample, timeoutInterval);
   });
};

if (speck && speck.isConnected()) {
   // first, get the logging interval, so we know how often this Speck will be producing data for us
   speck.getSpeckConfig(function(err1, config) {
      if (err1) {
         error("Failed to get the Speck config.  Aborting.  Error: " + err1);
      }
      else {
         info("Connected to Speck " + config.id);

         // set the output filename
         dataSamplesFile = path.join(__dirname, "speck_" + config.id + ".csv");

         // remember the sample interval (but convert to milliseconds)
         sampleIntervalMillis = config.loggingIntervalSecs * 1000;

         // now, get a current sample so we can build an array of field names we'll be writing to the CSV
         speck.getCurrentSample(function(err2, response) {
            if (err2) {
               error("Failed to get a current sample.  Aborting.  Error: " + err2);
            }
            else {
               // get the field names
               for (var field in response) {
                  if (response.hasOwnProperty(field)) {
                     csvFieldNames.push(field);
                  }
               }

               // Now that we have the field names, create the output file, if necessary, and write the header line
               if (!fs.existsSync(dataSamplesFile)) {
                  var header = arrayToCsvRecord(csvFieldNames);
                  fs.writeFileSync(dataSamplesFile, header);
               }

               // Finally, kick of the reading of the samples
               readSample();
            }
         });
      }
   });

}