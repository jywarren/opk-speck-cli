/**
 * Attempts to find the given needle in the given haystack using the given comparator.  If found, it returns the
 * index of the element; otherwise it returns a negative number which is the complement of the insertion index.
 *
 * Throws a TypeError if:
 * 1) the haystack is undefined or null
 * 2) the hackstack object does not provide a <code>size()</code> method for returning the number of items in the collection.
 * 3) the hackstack object does not provide a <code>get(index, callback(err, itemAtIndex))</code> method for returning the item at the given zero-based index.
 * 4) the needle is undefined
 * 5) the comparator is not a function
 * 6) the done is not a function
 *
 * @param {Object} haystack the "array" to search, represented by an object with implements a <code>.get(int)</code> method
 * @param {*} needle the item to find
 * @param {function} comparator the comparator to use
 * @param {function} done the function called at the end of the search with the index of the element or the complement of the insertion index
 */
var binarySearch = function(haystack, needle, comparator, done) {
   if (typeof haystack === 'undefined' || haystack == null) {
      throw new TypeError("binarySearch: first argument (haystack) cannot be null or undefined");
   }

   if (typeof haystack.size !== 'function') {
      throw new TypeError("binarySearch: first argument (haystack) does not provide a 'size' method");
   }

   if (typeof haystack.get !== 'function') {
      throw new TypeError("binarySearch: first argument (haystack) does not provide a 'get' method");
   }

   if (typeof needle === 'undefined') {
      throw new TypeError("binarySearch: second argument (needle) cannot be undefined");
   }

   if (typeof comparator !== "function") {
      throw new TypeError("binarySearch: third argument (comparator) is not a function");
   }

   if (typeof done !== "function") {
      throw new TypeError("binarySearch: fourth argument (done) is not a function");
   }

   // TODO: Find my source for this and give credit.  Can't remember where I found it...
   var binarySearchWorkhorse = function(low, mid, high, cmp) {
      if (low <= high) {
         /* Note that "(low + high) >>> 1" may overflow, and results in a typecast
          * to double (which gives the wrong results).
          * See: http://googleresearch.blogspot.com/2006/06/extra-extra-read-all-about-it-nearly.html
          */
         mid = low + (high - low >> 1);

         haystack.get(mid, function(err, candidate) {
            cmp = comparator(candidate, needle) | 0;

            if (cmp < 0) {                      // too low
               low = mid + 1;
               binarySearchWorkhorse(low, mid, high, cmp);
            }
            else if (cmp > 0) {                 // too high
               high = mid - 1;
               binarySearchWorkhorse(low, mid, high, cmp);
            }
            else {                              // found!
               done(mid);
            }
         });
      }
      else {
         /* Key not found. */
         done(~low);
      }

   };

   binarySearchWorkhorse(0, 0, haystack.size() - 1, 0);

};

module.exports = binarySearch;