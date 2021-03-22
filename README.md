# Run Web site with BFS crawling capabilities

* Server
    * WS JS
    * Express JS
* Client
    * Vue

## Requirements

* [Node.js](https://nodejs.org/) (this sample tested with 10.x)
* [Git](https://git-scm.com/downloads)

## Get Code

* Clone or download this [repository](https://github.com/talpasco/bfs-crawler)
    * `git clone https://github.com/talpasco/bfs-crawler` 
* `cd bfs-crawler` - move into directory just created
* `npm install` to install dependencies

## Build website code
 
* `npm run prebuild` to prep directories
* `npm run build` to transpile typescript into javascript into `/dist` folder

## Run website code

* `npm run open` to open browser to http://localhost:3001
* `npm run start`


## Run process over and over

* `npm run start:all:again` - prebuilt, build, start, and open in browser