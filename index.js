var Speck = require('speck-sensor');
var fs = require('fs');
var path = require('path');
var info = require('debug')('info');
var error = require('debug')('error');

var LINE_SEPARATOR = "\n";
var ONE_MINUTE = 60 * 1000;

var speck = null;
var csvFieldNames = [];
var sampleIntervalMillis = null;
var dataSamplesFile = null;

var preferredSpeckPath = null;
if (process.env['SPECK_PATH']) {
   preferredSpeckPath = process.env['SPECK_PATH'];
}

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

      if (err) {
         error("Error getting sample.  Will disconnect, wait 1 minute, and then reconnect and try again.  Error: " + err);
         try {
            speck.disconnect();
         }
         catch (e) {
            error("Error while trying to disconnect from the Speck: " + e);
         }

         setTimeout(connect, ONE_MINUTE);
      }
      else {
         // if the sample wasn't null, then a sample was found
         var wasDataFound = dataSample != null;
         if (wasDataFound) {
            writeSample(dataSample);
         }

         // If a sample was found, then try to read another immediately.  Otherwise, set the timeout interval to
         // whatever the Speck's logging interval is
         setTimeout(readSample, wasDataFound ? 1 : sampleIntervalMillis);
      }
   });
};

var connect = function() {
   var speckHidDescriptors = Speck.enumerate();
   if (speckHidDescriptors.length <= 0) {
      info("No Specks found!");
   }
   else {
      info("Path names of all connected Specks:");

      var hidDescriptorOfPreferredSpeck = null;
      for (var i = 0; i < speckHidDescriptors.length; i++) {
         var hidDescriptor = speckHidDescriptors[i];
         info("   " + hidDescriptor.path);

         // remember this HID descriptor if the user specified a preferred path and this one matches
         if (preferredSpeckPath && hidDescriptor.path == preferredSpeckPath) {
            hidDescriptorOfPreferredSpeck = hidDescriptor;
         }
      }

      if (preferredSpeckPath) {
         info("Connecting to the Speck at path " + preferredSpeckPath + "...");
         try {
            speck = new Speck(hidDescriptorOfPreferredSpeck);
         }
         catch (e) {
            error("Failed to connect to the Speck at path " + preferredSpeckPath);
            speck = null;
         }
      }
      else {
         info("Connecting to the first Speck found...");
         speck = Speck.create();
      }
   }

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

            // give the Speck a few seconds to start collecting data, and then kick of the initialization
            setTimeout(readSampleInitialization, 3000);
         }
      });
   }
   else {
      error("Failed to connect to a Speck.  Will retry in 1 minute.");
      setTimeout(connect, ONE_MINUTE);
   }
};

var readSampleInitialization = function() {
   // get a current sample so we can build an array of field names we'll be writing to the CSV
   speck.getCurrentSample(function(err2, dataSample) {
      if (err2) {
         error("Failed to get a current sample.  Aborting.  Error: " + err2);
      }
      else {
         // get the field names
         csvFieldNames = [];
         for (var field in dataSample) {
            if (dataSample.hasOwnProperty(field)) {
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
};

connect();