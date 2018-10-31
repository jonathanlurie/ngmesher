#!/usr/bin/env node

const fs = require('fs')
const pk = require('../package.json')
const ArgumentParser = require('argparse').ArgumentParser
const objParser = require('parse-wavefront-obj')
const ngmesher = require('../')

//console.log(objParser);

var parser = new ArgumentParser({
  version: pk.version,
  addHelp: true,
  description: 'ngmeshermake converts a OBJ mesh into a Neuroglancer mesh file.'
})

parser.addArgument(
  ['--obj', '-obj'],
  {
    help: 'The path to a Wavefront OBJ mesh file'
  }
)

parser.addArgument(
  ['--out', '-o'],
  {
    help: 'The path to the NG mesh file to write'
  }
)


var args = parser.parseArgs()
//console.log(args)

// quicting if no output is specified
if (!args.out) {
  parser.printHelp()
}

// the inout is OBJ file
if (args.obj) {
  objToNg(args.obj, args.out)
}


function objToNg(pathObj, pathNg) {


  let objStr = fs.readFileSync(pathObj, "utf8")
  let meshData = objParser(objStr)

  const verticesPerPolygon = meshData.cells[0].length
  let indices = new Uint32Array( 3 * meshData.cells.length )
  let positions = new Float32Array( 3 * meshData.positions.length )

  // flattening the indices
  for (let i=0; i<meshData.cells.length; i += 1) {
    let newIndex = i * verticesPerPolygon
    for (let ii=0; ii<verticesPerPolygon; ii += 1) {
      indices[newIndex + ii] = meshData.cells[i][ii]
    }
  }

  // flatening the positions
  for (let p=0; p<meshData.positions.length; p += 1) {
    let newIndex = p * 3
    positions[newIndex] = meshData.positions[p][0]
    positions[newIndex+1] = meshData.positions[p][1]
    positions[newIndex+2] = meshData.positions[p][2]
  }

  let ngMeshBuffer = ngmesher.encode(positions, indices)
  fs.writeFileSync(pathNg, new Buffer(ngMeshBuffer))
}
