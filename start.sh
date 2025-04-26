#!/bin/bash

chmod +x ./pocketbase

nohup node server.js &
nohup ./pocketbase serve --http 143.110.162.204:8090
