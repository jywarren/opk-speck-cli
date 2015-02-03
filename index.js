var Speck = require('speck-sensor');
var fs = require('fs');
var path = require('path');
var log4js = require('log4js');
log4js.configure('log4js-config.json');
var log = log4js.getLogger("speck-gateway");

log.info("---------------------- Speck Gateway ----------------------");

var LINE_SEPARATOR = "\n";
var ONE_MINUTE_IN_MILLIS = 60 * 1000;
var MAX_SECONDS_IN_FUTURE_FOR_NEW_SAMPLES = 3 * 60;   // 3 minutes

var speck = null;
var csvFieldNames = [];
var sampleIntervalMillis = null;
var dataSamplesFile = null;
var previousTimestamp = null;

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
   if (log.isDebugEnabled()) {
      log.debug("Writing sample: " + JSON.stringify(dataSample) + " as " + JSON.stringify(record));
   }
   fs.appendFileSync(dataSamplesFile, record);
};

var readSample = function() {
   speck.getSample(function(err, dataSample) {

      if (err) {
         log.error("Error getting sample.  Will disconnect, wait 1 minute, and then reconnect and try again.  Error: " + err);
         try {
            speck.disconnect();
         }
         catch (e) {
            log.error("Error while trying to disconnect from the Speck: " + e);
         }

         setTimeout(connect, ONE_MINUTE_IN_MILLIS);
      }
      else {
         // if the sample wasn't null and the timestamp is positive, then a sample was found
         var wasDataFound = dataSample != null &&
                            dataSample['sampleTimeSecs'] > 0;
         if (wasDataFound) {
            // make sure the timestamp is increasing (Bad Things may happen if the CSV isn't sorted asc by time)
            var isTimestampStrictlyIncreasing = previousTimestamp == null ||
                                                previousTimestamp < dataSample['sampleTimeSecs'];
            if (isTimestampStrictlyIncreasing) {
               var maxTimeInFuture = (Date.now() / 1000) + MAX_SECONDS_IN_FUTURE_FOR_NEW_SAMPLES;
               if (dataSample['sampleTimeSecs'] < maxTimeInFuture) {
                  previousTimestamp = dataSample['sampleTimeSecs'];
                  //log.debug("Writing sample: " + JSON.stringify(dataSample));
                  writeSample(dataSample);
               }
               else {
                  log.error("Skipping sample because the timestamp is more than [" + MAX_SECONDS_IN_FUTURE_FOR_NEW_SAMPLES + "] seconds in the future: " + JSON.stringify(dataSample));
               }
            } else {
               log.error("Skipping sample because the timestamp is less than the previous timestamp [" + previousTimestamp + "]: " + JSON.stringify(dataSample));
            }
         } else {
            if (log.isDebugEnabled()) {
               log.debug("No data found: " + JSON.stringify(dataSample));
           }
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
      log.info("No Specks found!");
   }
   else {
      log.info("Path names of all connected Specks:");

      var hidDescriptorOfPreferredSpeck = null;
      for (var i = 0; i < speckHidDescriptors.length; i++) {
         var hidDescriptor = speckHidDescriptors[i];
         log.info("   " + hidDescriptor.path);

         // remember this HID descriptor if the user specified a preferred path and this one matches
         if (preferredSpeckPath && hidDescriptor.path == preferredSpeckPath) {
            hidDescriptorOfPreferredSpeck = hidDescriptor;
         }
      }

      if (preferredSpeckPath) {
         log.info("Connecting to the Speck at path " + preferredSpeckPath + "...");
         try {
            speck = new Speck(hidDescriptorOfPreferredSpeck);
         }
         catch (e) {
            log.error("Failed to connect to the Speck at path " + preferredSpeckPath);
            speck = null;
         }
      }
      else {
         log.info("Connecting to the first Speck found...");
         speck = Speck.create();
      }
   }

   if (speck && speck.isConnected()) {
      // first, get the logging interval, so we know how often this Speck will be producing data for us
      speck.getSpeckConfig(function(err, config) {
         if (err) {
            log.error("Failed to get the Speck config.  Aborting.  Error: " + err);
         }
         else {
            log.info("Connected to Speck " + config.id);

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
      log.error("Failed to connect to a Speck.  Will retry in 1 minute.");
      setTimeout(connect, ONE_MINUTE_IN_MILLIS);
   }
};

var readSampleInitialization = function() {
   // get a current sample so we can build an array of field names we'll be writing to the CSV
   speck.getCurrentSample(function(err, dataSample) {
      if (err) {
         log.error("Failed to get a current sample.  Aborting.  Error: " + err);
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