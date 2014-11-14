Node Speck Gateway
==================

A Node.js gateway for the CMU CREATE Lab Speck particle sensor.  This initial version only writes to a CSV.

Usage
=====

Run the downloader with:

    node downloader.js

Or, if you use [nodemon](https://github.com/remy/nodemon):

    nodemon downloader.js
    
If you want to connect to a Speck on a particular port, use something like this:

    SPECK_PATH=0001:0005:00 node downloader.js

Installation on a Raspberry Pi
==============================

Here's what to do to get the Node Speck Gateway running on a Raspberry Pi with Raspbian.  These instructions are based on Josh Marinacci's excellent [instructions for installing Node on a Raspberry Pi](http://joshondesign.com/2013/10/23/noderpi).

1. Update Rasbian:

        $ sudo apt-get upgrade; 
        $ sudo apt-get update;

2. We need `libusb`, so do:
   
        $ sudo apt-get install libusb-1.0-0
        $ sudo apt-get install libusb-1.0-0-dev

3. Go to [http://nodejs.org/dist/](http://nodejs.org/dist/) and look for the latest version of Node.js for Raspberry Pi.  You pretty much have to just poke around in the various version directories until you find it.  Just start with the most recent and work backwards checking each version's directory until you find one with a tarball with `linux-arm-pi` in the name.  As of this writing (2014-09-24), the latest version for Pi is v0.10.28.  If you find a newer version, use it, and just modify the following instructions accordingly. Anwyay, download and install Node.js: 

        $ cd
        $ mkdir node
        $ cd node
        $ wget http://nodejs.org/dist/v0.10.28/node-v0.10.28-linux-arm-pi.tar.gz
        $ tar -xvzf node-v0.10.28-linux-arm-pi.tar.gz
        $ rm node-v0.10.28-linux-arm-pi.tar.gz

4. Add this to the end of your `~/.bashrc`, modifying the `NODE_JS_HOME` path as necessary:

        # Node.js
        NODE_JS_HOME=/home/pi/node/node-v0.10.28-linux-arm-pi
        PATH=$PATH:$NODE_JS_HOME/bin

5. Log out, then log back in so Node's binaries are on your path. You can test with:

        $ node --version
        
    It should print:
        
        v0.10.28

6. Install node-gyp:

        $ npm install -g node-gyp

7. Clone this repository, install its dependences, and copy the Speck `.rules` file:

        $ cd ~
        $ git clone https://github.com/CMU-CREATE-Lab/node-speck-gateway.git
        $ cd node-speck-gateway
        $ npm install
        $ sudo cp node_modules/speck-sensor/etc/linux/55-speck.rules /etc/udev/rules.d/.

8. Restart the Raspberry Pi:

        $ sudo shutdown -r now

9. SSH back in to the Raspberry Pi.

10. Finally, run the Speck Gateway:

	     $ cd ~/node-speck-gateway
	     $ node downloader.js