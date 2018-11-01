#!/usr/bin/env node

// !/usr/bin/env node --inspect-brk

const process = require('process')
const path = require('path')
const fs = require('fs')
const pk = require('../package.json')
const ArgumentParser = require('argparse').ArgumentParser
const objParser = require('parse-wavefront-obj')
const ngmesher = require('../')

const NG_MESH_EXT = "ngmesh"

/**
 * Reads a OBJ file and return the mesh data
 * @param {String} pathObj - path to the OBJ mesh file
 * @return {Object} mesh data of the form {vertices: Float32Array, triangles: Uint32Array}
 */
function objToMeshData(pathObj) {
  let objStr = fs.readFileSync(pathObj, "utf8")
  let meshData = objParser(objStr)

  const verticesPerPolygon = meshData.cells[0].length
  let triangles = new Uint32Array( 3 * meshData.cells.length )
  let vertices = new Float32Array( 3 * meshData.positions.length )

  // flattening the triangles
  for (let i=0; i<meshData.cells.length; i += 1) {
    let newIndex = i * verticesPerPolygon
    for (let ii=0; ii<verticesPerPolygon; ii += 1) {
      triangles[newIndex + ii] = meshData.cells[i][ii]
    }
  }

  // flatening the vertices
  for (let p=0; p<meshData.positions.length; p += 1) {
    let newIndex = p * 3
    vertices[newIndex] = meshData.positions[p][0]
    vertices[newIndex+1] = meshData.positions[p][1]
    vertices[newIndex+2] = meshData.positions[p][2]
  }

  return {
    vertices: vertices,
    triangles: triangles
  }
}

function stringToMatrix(matStr) {
  const regex = /\[{1}\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\,\s*(\-?\d+\.?\d*)\s*\s*\]{1}/;

  let match = regex.exec(matStr)
  let matrix = null

  if (match) {
    matrix = new Float32Array(16)
    for (let i=1; i<=16; i++) {
      matrix[i-1] = parseFloat(match[i])
    }
  }
  return matrix
}

/**
 * Apply an affine transformation on a vector. MODIFIES IN PLACE
 * @param {Float32Array} v - the vector to modify, of shape [x, y, z]. Will be modified
 * @param {Float32Array} m - inline 4x4 matrix in a column major fashion
 */
function affineTransform(v, m) {
  let x = v[0], y = v[1], z = v[2], w = 1;
  v[0] = m[0] * x + m[4] * y + m[8]  * z + m[12] * w;
  v[1] = m[1] * x + m[5] * y + m[9]  * z + m[13] * w;
  v[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
}

function applyMatrix (vertices, mat) {
  for (let i=0; i<vertices.length; i+=3) {
    let vector = vertices.subarray(i, i+3)
    affineTransform(vector, mat)
  }
}



/**
 * Write the mesh data into a Neuroglancer mesh file
 * @param {Object} mesh data of the form {vertices: Float32Array, triangles: Uint32Array}
 * @param {String} pathNg - path to the Neuroglancer mesh file to write
 */
function meshDataToNgMesh(meshData, pathNg) {
  let ngMeshBuffer = ngmesher.encode(meshData.vertices, meshData.triangles)
  fs.writeFileSync(pathNg, new Buffer(ngMeshBuffer))
}


/**
 * Get the basename of a file without extension
 * @param {String} path - a path to a file
 * @return {String} the name of the file without extension
 */
function getBasename(filePath) {
  let name = path.basename(filePath)
  let dotIndex = name.lastIndexOf('.')

  if (dotIndex >= 0) {
    name = name.slice(0, dotIndex)
  }
  return name
}



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

parser.addArgument(
  ['--index', '-i'],
  {
    help: 'Write the JSON index for to mesh to be generated (optional)'
  }
)

parser.addArgument(
  ['--transformation', '-t'],
  {
    help: 'Affine transformation to apply to the input. This must be a 4x4 matrix, written in a column-major fashion using quotes, square brackets and coma separated numbers, such as "[1, 0, 0, 0, ...]"'
  }
)

var args = parser.parseArgs()
//console.log(args);

// quiting if no output is specified
if (!args.out) {
  parser.printHelp()
}

let meshData = null

// the input is OBJ file
if (args.obj) {
  meshData = objToMeshData(args.obj)
}

// app,ying a transformation, if in arguments
if (args.transformation) {
  let matrix = stringToMatrix(args.transformation)
  let verticesCopy = new Float32Array(meshData.vertices)
  applyMatrix(meshData.vertices, matrix)
}

//process.exit()


// writing the mesh data in a NG mesh file
if (meshData) {
  let outPath = args.out
  let outFolder = path.dirname(outPath)
  let outBasename = getBasename(outPath)
  let outMeshBasename = outBasename + "." + NG_MESH_EXT
  let outMeshFilepath = path.join(outFolder, outMeshBasename)
  let outJsonFilepath = path.join(outFolder, outBasename)

  // json content of index file
  let jsonIndex = JSON.stringify( { fragments: [outMeshBasename] } )
  fs.writeFileSync(outJsonFilepath, jsonIndex)

  let ngMeshBuffer = ngmesher.encode(meshData.vertices, meshData.triangles)
  fs.writeFileSync(outMeshFilepath, new Buffer(ngMeshBuffer))
}
