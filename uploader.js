var log4js = require('log4js');
log4js.configure('uploader-log4js-config.json');
var log = log4js.getLogger("speck-uploader");

var config = require('./uploader-config');
var superagent = require('superagent');
var flow = require('nimble');
var exec = require('child_process').exec;
var binarySearch = require('./lib/binarySearch')

var maxTimeSecs = null;
var error = null;
var hasNoError = function() {
   return error == null;
};
var startingLineNumber = null;
var isStartingLineNumberUnknown = function() {
   return startingLineNumber == null;   // sed/tail/head are all one-based!
};
var numLines = null;
var csvLinesToUpload = null;
var jsonToUpload = null;

var getMaxTimeSeconds = function(callback) {
   superagent
         .get(config.get("esdr:apiRootUrl") + "/feed?fields=maxTimeSecs")
         .set({
                 FeedApiKey : config.get("esdr:feedId")
              })
         .end(function(err, res) {
                 if (err) {
                    return callback(err);
                 }

                 if (res) {
                    if (res.status == 200) {
                       if (res.body) {
                          if (res.body.data) {
                             return callback(null, res.body.data.maxTimeSecs)
                          }
                          return callback(new Error("Missing response data!"));
                       }
                       return callback(new Error("Missing response body!"));
                    }
                    return callback(new Error("Unexpected response status [" + res.status + "]"));
                 }
                 return callback(new Error("No response from ESDR!"));
              });
};

var findStartingLineNumber = function(callback) {
   // use "wc -l" to get the total number of lines in the file
   exec("wc -l " + config.get("csv"), function(err, stdout) {
      if (err) {
         return callback(err);
      }

      if (stdout == null) {
         return callback(new Error("Null result from wc!"));
      }

      numLines = stdout.trim().split(/\s/)[0];
      log.trace("numLines:     " + numLines);

      // binary search the CSV for the starting line index
      binarySearch({
                      size : function() {
                         return numLines;
                      },
                      get : function(index, callback) {
                         var lineNumber = index + 1;  // add one since sed assumes 1-based

                         // got this bit of sed magic from http://stackoverflow.com/a/448047/703200
                         exec("sed -n '" + lineNumber + "p' " + config.get("csv"), function(err, stdout) {
                            if (err) {
                               throw err;
                            }
                            if (stdout == null) {
                               return callback(new Error("Null result from sed!"));
                            }

                            var line = stdout.trim();
                            var fields = line.split(',');   // TODO: make delimiter configurable
                            var time = fields[0];
                            log.trace("sed found line: " + line + " --> [" + time + "] at line # " + lineNumber);
                            callback(null, time);
                         });
                      }
                   },
                   maxTimeSecs,
                   function(a, b) {
                      if (a < b) {
                         return -1;
                      }
                      if (a > b) {
                         return 1;
                      }
                      return 0;
                   },
                   function(index) {
                      log.trace("Binary search result=" + index);
                      callback(null, (index < 0) ? index - 1 : index + 1);  // +/-1 to account for the header line
                   });
   });
};

var csvToJson = function(csv) {
   if (csv) {
      var lines = csv.split('\n');
      var json = {
         "channel_names" : ["humidity", "raw_particles", "particle_concentration"],
         "data" : []
      };
      lines.forEach(function(line) {
         var fields = line.split(',')  // TODO: get delimiter from config
         json.data.push(fields);
      });
      return json;
   }
   return null;
};

flow.series([
               // TODO: check to make sure the CSV file even exists!
               function(done) {
                  done();
               },

               // fetch the timestamp of the last data point from ESDR
               function(done) {
                  getMaxTimeSeconds(function(err, theMaxTimeSecs) {
                     if (err) {
                        error = err
                     }
                     else {
                        maxTimeSecs = theMaxTimeSecs;

                        log.debug("maxTimeSecs = [" + maxTimeSecs + "]");

                        // start at the beginning of the file if nothing has been uploaded yet
                        if (maxTimeSecs == null) {
                           startingLineNumber = 1;    // start at line 1 because we want to skip the header
                        }
                     }
                     done();
                  });
               },

               // find the correct starting line, if necessary
               function(done) {
                  if (isStartingLineNumberUnknown() && hasNoError()) {
                     findStartingLineNumber(function(err, lineNumber) {
                        // todo
                        if (err) {
                           error = err;
                        }
                        else {
                           startingLineNumber = lineNumber;
                           log.info("Got startingLineNumber of " + startingLineNumber);
                        }
                        done();
                     });

                  }
                  else {
                     done();
                  }
               },

               // now that we know the starting line number, read lines from the CSV
               function(done) {
                  if (!isStartingLineNumberUnknown() && hasNoError()) {
                     // line with maxTimeSecs wasn't found--figure out why
                     if (startingLineNumber < 0) {
                        var insertionLineNumber = ~startingLineNumber;

                        // if the maxTimeSecs line falls BEFORE the first record in the CSV, then that means all the
                        // data in the CSV is newer, so just start reading from the beginning
                        if (insertionLineNumber <= 1) {
                           startingLineNumber = 1;
                        }
                        else if (insertionLineNumber <= numLines) {
                           startingLineNumber = insertionLineNumber - 1;
                        }
                     }

                     if (startingLineNumber > 0 && (numLines == null || startingLineNumber < numLines)) {
                        // Add 1 to startingLineNumber so that we skip the line containing maxTimeSecs--it's
                        // already been uploaded, so no need to do so again.
                        startingLineNumber++;

                        log.info("Now need to read lines from the CSV, starting at line [" + startingLineNumber + "]");

                        // Read the lines by doing a tail and piping to head (TODO: is there a better way?). Note that
                        exec("tail -n +" + startingLineNumber + " " + config.get("csv") + " | head -n " + config.get("maxRecordsPerUpload"), function(err, stdout) {
                           if (err) {
                              error = err;
                           }
                           else {
                              csvLinesToUpload = stdout.trim();
                           }
                           done();
                        });
                     }
                     else {
                        log.info("No new data to upload!");
                     }
                  }
               },

               // convert the CSV to JSON
               function(done) {
                  if (csvLinesToUpload != null) {
                     jsonToUpload = csvToJson(csvLinesToUpload);
                     done();
                  }
               },

               // upload to ESDR!
               function(done) {
                  if (jsonToUpload != null) {
                     superagent
                           .put(config.get("esdr:apiRootUrl") + "/feed")
                           .set({
                                   FeedApiKey : config.get("esdr:feedId")
                                })
                           .send(jsonToUpload)
                           .end(function(err, res) {
                                   if (err || res == null) {
                                      error = err;
                                   }
                                   else {
                                      log.debug(JSON.stringify(res.body, null, 3));
                                   }
                                   done();
                                });
                  }
               }
            ],
      // handle outcome
            function() {
               // TODO: deal with possible error
               log.info("All done!");
            }
);
