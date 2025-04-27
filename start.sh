#!/bin/bash



# Run node server.js in the background and redirect output to a log file
nohup node server.js > server.log 2>&1 &


