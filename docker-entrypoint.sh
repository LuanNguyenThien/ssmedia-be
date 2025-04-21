#!/bin/sh
cross-env NODE_ENV=production pm2 start ./build/src/app.js -i 5 --attach --watch | ./node_modules/.bin/bunyan