#!/bin/sh
NODE_ENV=production pm2 start ./build/src/app.js -i 2 --no-daemon | ./node_modules/.bin/bunyan